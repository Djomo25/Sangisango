import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Conversation, Correction, Message, StatutConversation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parserPagination } from '../common/pagination.util';

const STATUTS_VALIDES: StatutConversation[] = ['en_cours', 'terminee', 'attention', 'abandon'];

// Durée pendant laquelle l'IA arrête de répondre automatiquement après que le
// commerçant a "pris la main" sur une conversation depuis le dashboard.
const DUREE_SUSPENSION_IA_MINUTES = 60;

// Une conversation "en_cours"/"attention" sans nouveau message depuis ce délai,
// et sans rendez-vous actif à venir, est considérée comme abandonnée.
const DELAI_ABANDON_MS = 2 * 24 * 60 * 60 * 1000;

export interface ConversationAvecApercu extends Conversation {
  dernierMessage: Message | null;
}

export interface ListeConversations {
  data: ConversationAvecApercu[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste les conversations du commerçant connecté, triées par date du dernier
   * message (plus récent d'abord), avec filtre optionnel par statut et pagination.
   */
  async lister(
    commercantId: string,
    statut: string | undefined,
    limitRaw: string | undefined,
    offsetRaw: string | undefined,
  ): Promise<ListeConversations> {
    if (statut && !STATUTS_VALIDES.includes(statut as StatutConversation)) {
      throw new BadRequestException(
        `Statut invalide. Valeurs possibles : ${STATUTS_VALIDES.join(', ')}.`,
      );
    }

    const { limit, offset } = parserPagination(limitRaw, offsetRaw);

    const conversations = await this.prisma.conversation.findMany({
      where: { commercantId, ...(statut ? { statut: statut as StatutConversation } : {}) },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    // Tri par date du dernier message en mémoire : Prisma ne permet pas de trier
    // par le max() d'une relation one-to-many directement dans orderBy.
    const triees = conversations
      .map(({ messages, ...conversation }) => ({
        ...conversation,
        dernierMessage: messages[0] ?? null,
      }))
      .sort((a, b) => {
        const dateA = (a.dernierMessage?.createdAt ?? a.createdAt).getTime();
        const dateB = (b.dernierMessage?.createdAt ?? b.createdAt).getTime();
        return dateB - dateA;
      });

    return {
      data: triees.slice(offset, offset + limit),
      total: triees.length,
      limit,
      offset,
    };
  }

  /**
   * Détail d'une conversation (scopée au commerçant connecté) avec son
   * historique complet et son rendez-vous le plus récent, le cas échéant.
   */
  async detail(commercantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, commercantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        rendezVous: { orderBy: { createdAt: 'desc' }, take: 1, include: { creneau: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    const { rendezVous, ...reste } = conversation;
    return { ...reste, rendezVous: rendezVous[0] ?? null };
  }

  /**
   * Le commerçant reprend la main sur la conversation : statut "en_cours" et
   * suspension temporaire des réponses automatiques de l'IA.
   */
  async prendreLaMain(commercantId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, commercantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        statut: 'en_cours',
        iaSuspendueJusqua: new Date(Date.now() + DUREE_SUSPENSION_IA_MINUTES * 60_000),
      },
    });
  }

  /**
   * Marque manuellement la conversation comme "terminee", à tout moment et
   * indépendamment des règles automatiques du cron ci-dessous.
   */
  async terminer(commercantId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, commercantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { statut: 'terminee' },
    });
  }

  /**
   * Enregistre une correction proposée par le commerçant sur une réponse de
   * l'IA. Vérifie que le message corrigé appartient bien à cette conversation.
   */
  async ajouterCorrection(
    commercantId: string,
    conversationId: string,
    messageOriginalId: string,
    suggestionCommercant: string,
  ): Promise<Correction> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, commercantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageOriginalId, conversationId },
    });

    if (!message) {
      throw new NotFoundException('Message introuvable dans cette conversation.');
    }

    return this.prisma.correction.create({
      data: { conversationId, messageOriginalId, suggestionCommercant },
    });
  }

  /**
   * Applique chaque nuit les deux règles de statut automatique qui n'étaient
   * couvertes par aucune autre logique :
   *
   * a) "terminee" : la conversation a un rendez-vous confirmé dont le créneau
   *    est déjà passé — l'échange est terminé de fait.
   * b) "abandon" : la conversation est encore "en_cours"/"attention", son
   *    dernier message (client, IA ou commerçant) date de plus de 2 jours, et
   *    elle n'a aucun rendez-vous actif (à confirmer, ou confirmé mais à
   *    venir) qui justifierait de la garder ouverte.
   *
   * Nommé "reglesStatutConversations" pour pouvoir être déclenché manuellement
   * en local via `npm run cron:declencher -- ConversationsService
   * appliquerReglesStatutAutomatique` (voir README).
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'reglesStatutConversations' })
  async appliquerReglesStatutAutomatique(): Promise<void> {
    const maintenant = new Date();

    const { count: nbTerminees } = await this.prisma.conversation.updateMany({
      where: {
        statut: { not: 'terminee' },
        rendezVous: {
          some: {
            statut: 'confirme',
            creneau: { dateHeure: { lt: maintenant } },
          },
        },
      },
      data: { statut: 'terminee' },
    });
    this.logger.log(`Règle "terminee" (rendez-vous confirmé passé) : ${nbTerminees} conversation(s) mise(s) à jour.`);

    const seuilAbandon = new Date(maintenant.getTime() - DELAI_ABANDON_MS);

    const { count: nbAbandons } = await this.prisma.conversation.updateMany({
      where: {
        statut: { in: ['en_cours', 'attention'] },
        // "every" est vrai pour une relation vide : on exige explicitement au
        // moins un message pour ne jamais viser une conversation sans historique.
        AND: [{ messages: { some: {} } }, { messages: { every: { createdAt: { lt: seuilAbandon } } } }],
        rendezVous: {
          none: {
            statut: { in: ['a_confirmer', 'confirme'] },
            creneau: { dateHeure: { gt: maintenant } },
          },
        },
      },
      data: { statut: 'abandon' },
    });
    this.logger.log(`Règle "abandon" (aucun message depuis 2 jours, sans rendez-vous actif) : ${nbAbandons} conversation(s) mise(s) à jour.`);
  }
}
