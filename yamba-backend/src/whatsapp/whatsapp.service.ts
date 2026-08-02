import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IaService } from '../ia/ia.service';
import type {
  WhatsappContact,
  WhatsappIncomingMessage,
  WhatsappWebhookPayload,
} from './types/whatsapp-webhook.types';

const META_GRAPH_API_VERSION = 'v21.0';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IaService))
    private readonly iaService: IaService,
  ) {}

  private get mockMode(): boolean {
    return this.configService.get<string>('MOCK_MODE') === 'true';
  }

  /**
   * Envoie un message texte WhatsApp via l'API Cloud de Meta.
   * En MOCK_MODE, se contente de logger le message (aucun appel réseau).
   */
  async envoyerMessage(numeroDestinataire: string, texte: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Message WhatsApp -> ${numeroDestinataire} : ${texte}`);
      return;
    }

    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const apiToken = this.configService.get<string>('WHATSAPP_CLOUD_API_TOKEN');

    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroDestinataire,
          type: 'text',
          text: { body: texte },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Échec de l'envoi WhatsApp (${response.status}): ${errorBody}`);
    }
  }

  /**
   * Traite le payload reçu sur le webhook Meta : pour chaque message entrant,
   * retrouve/crée la conversation, enregistre le message, puis délègue à l'IA.
   */
  async traiterWebhook(payload: WhatsappWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const messages = value?.messages;

        // Ignore les notifications qui ne sont pas des messages entrants
        // (ex: accusés de statut "delivered"/"read").
        if (!messages?.length) {
          continue;
        }

        const numeroCommercant = value.metadata?.display_phone_number;
        if (!numeroCommercant) {
          continue;
        }

        const commercant = await this.prisma.commercant.findUnique({
          where: { numeroWhatsapp: numeroCommercant },
        });

        if (!commercant) {
          this.logger.warn(`Aucun commerçant trouvé pour le numéro WhatsApp ${numeroCommercant}`);
          continue;
        }

        for (const message of messages) {
          await this.traiterMessageEntrant(commercant.id, message, value.contacts);
        }
      }
    }
  }

  private async traiterMessageEntrant(
    commercantId: string,
    message: WhatsappIncomingMessage,
    contacts?: WhatsappContact[],
  ): Promise<void> {
    const clientTelephone = message.from;
    const clientNom = contacts?.find((c) => c.wa_id === clientTelephone)?.profile?.name;

    // Réutilise le fil de discussion en cours s'il existe, sinon en ouvre un nouveau.
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        commercantId,
        clientTelephone,
        statut: { in: ['en_cours', 'attention'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          commercantId,
          clientTelephone,
          clientNom,
        },
      });
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        expediteur: 'client',
        contenu: this.extraireContenuMessage(message),
      },
    });

    await this.iaService.genererReponse(conversation.id);
  }

  private extraireContenuMessage(message: WhatsappIncomingMessage): string {
    if (message.type === 'text' && message.text?.body) {
      return message.text.body;
    }
    return `[message non textuel: ${message.type}]`;
  }
}
