import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { RendezVous } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreneauxService } from '../creneaux/creneaux.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { formaterDateHeureFr } from '../common/date-fr.util';
import { parserPagination } from '../common/pagination.util';
import { bornesPourPeriode, validerPeriode } from '../common/periode.util';

// Durée pendant laquelle un créneau reste verrouillé en attente de confirmation
// par le commerçant, avant d'être libéré automatiquement par le cron de CreneauxService.
const DUREE_VERROUILLAGE_MINUTES = 60;

// Fenêtre "rappel" : un rendez-vous confirmé dont le créneau tombe dans les
// 24 prochaines heures reçoit un rappel (une seule fois, grâce à rappelEnvoye).
const FENETRE_RAPPEL_MS = 24 * 60 * 60 * 1000;

export interface ListeRendezVous {
  data: RendezVous[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class RendezVousService {
  private readonly logger = new Logger(RendezVousService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creneauxService: CreneauxService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * Liste les rendez-vous du commerçant connecté, triés par date de créneau
   * croissante, filtrés par période :
   * - "jour" : aujourd'hui uniquement
   * - "semaine" : les 7 prochains jours (fenêtre glissante, pas semaine calendaire)
   * - "a-venir" (défaut) : tous les rendez-vous futurs, sans limite haute
   */
  async lister(
    commercantId: string,
    periodeRaw: string | undefined,
    limitRaw: string | undefined,
    offsetRaw: string | undefined,
  ): Promise<ListeRendezVous> {
    const periode = validerPeriode(periodeRaw);
    const { gte, lte } = bornesPourPeriode(periode);
    const { limit, offset } = parserPagination(limitRaw, offsetRaw);

    const where = {
      conversation: { commercantId },
      creneau: {
        dateHeure: { gte, ...(lte ? { lte } : {}) },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.rendezVous.findMany({
        where,
        include: { creneau: true, conversation: true },
        orderBy: { creneau: { dateHeure: 'asc' } },
        take: limit,
        skip: offset,
      }),
      this.prisma.rendezVous.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  /**
   * Crée un rendez-vous "à confirmer" et verrouille le créneau associé, de
   * façon atomique : si la création du rendez-vous échoue, le verrouillage est
   * annulé (rollback de la transaction). Vérifie que la conversation et le
   * créneau appartiennent bien au commerçant fourni.
   */
  async creerRendezVous(
    commercantId: string,
    conversationId: string,
    creneauId: string,
    service: string,
  ): Promise<RendezVous> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, commercantId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    const creneau = await this.prisma.creneauDisponible.findFirst({
      where: { id: creneauId, commercantId },
    });
    if (!creneau) {
      throw new NotFoundException('Créneau introuvable.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.creneauxService.verrouillerCreneau(creneauId, DUREE_VERROUILLAGE_MINUTES, tx);

      return tx.rendezVous.create({
        data: {
          conversationId,
          creneauId,
          service,
          statut: 'a_confirmer',
        },
      });
    });
  }

  /**
   * Confirme le rendez-vous (scopé au commerçant connecté) : le créneau passe
   * en "reserve" (réservation définitive), et un message de confirmation est
   * envoyé au client.
   */
  async confirmerRendezVous(commercantId: string, rendezVousId: string): Promise<RendezVous> {
    const rendezVous = await this.prisma.rendezVous.findFirst({
      where: { id: rendezVousId, conversation: { commercantId } },
      include: { conversation: true },
    });

    if (!rendezVous) {
      throw new NotFoundException('Rendez-vous introuvable.');
    }

    const [rendezVousConfirme] = await this.prisma.$transaction([
      this.prisma.rendezVous.update({
        where: { id: rendezVousId },
        data: { statut: 'confirme' },
      }),
      this.prisma.creneauDisponible.update({
        where: { id: rendezVous.creneauId },
        data: { statut: 'reserve', verrouilleJusqua: null },
      }),
    ]);

    await this.whatsappService.envoyerMessage(
      rendezVous.conversation.clientTelephone,
      `Votre rendez-vous pour "${rendezVous.service}" est confirmé ✅`,
    );

    return rendezVousConfirme;
  }

  /**
   * Annule le rendez-vous (scopé au commerçant connecté) et libère le créneau
   * associé (redevient disponible).
   */
  async annulerRendezVous(commercantId: string, rendezVousId: string): Promise<RendezVous> {
    const rendezVous = await this.prisma.rendezVous.findFirst({
      where: { id: rendezVousId, conversation: { commercantId } },
    });

    if (!rendezVous) {
      throw new NotFoundException('Rendez-vous introuvable.');
    }

    const [rendezVousAnnule] = await this.prisma.$transaction([
      this.prisma.rendezVous.update({
        where: { id: rendezVousId },
        data: { statut: 'annule' },
      }),
      this.prisma.creneauDisponible.update({
        where: { id: rendezVous.creneauId },
        data: { statut: 'disponible', verrouilleJusqua: null },
      }),
    ]);

    return rendezVousAnnule;
  }

  /**
   * Envoie un rappel WhatsApp aux clients dont le rendez-vous confirmé a lieu
   * dans les prochaines 24h et n'a pas encore reçu de rappel. Nommé
   * "rappelsRendezVous" pour pouvoir être déclenché manuellement en local via
   * SchedulerRegistry (voir la documentation du projet pour la commande).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'rappelsRendezVous' })
  async envoyerRappelsRendezVous(): Promise<void> {
    const maintenant = new Date();
    const dansUnJour = new Date(maintenant.getTime() + FENETRE_RAPPEL_MS);

    const rendezVousARappeler = await this.prisma.rendezVous.findMany({
      where: {
        statut: 'confirme',
        rappelEnvoye: false,
        creneau: { dateHeure: { gte: maintenant, lte: dansUnJour } },
      },
      include: {
        creneau: true,
        conversation: { include: { commercant: true } },
      },
    });

    for (const rendezVous of rendezVousARappeler) {
      const message = `Rappel ⏰ : votre rendez-vous pour "${rendezVous.service}" chez ${
        rendezVous.conversation.commercant.nom
      } est prévu le ${formaterDateHeureFr(rendezVous.creneau.dateHeure)}. À bientôt !`;

      await this.whatsappService.envoyerMessage(rendezVous.conversation.clientTelephone, message);

      await this.prisma.rendezVous.update({
        where: { id: rendezVous.id },
        data: { rappelEnvoye: true },
      });
    }

    if (rendezVousARappeler.length > 0) {
      this.logger.log(`${rendezVousARappeler.length} rappel(s) de rendez-vous envoyé(s).`);
    }
  }
}
