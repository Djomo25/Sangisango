import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { WhatsappSignatureGuard } from './guards/whatsapp-signature.guard';
import { WhatsappService } from './whatsapp.service';
import type { WhatsappWebhookPayload } from './types/whatsapp-webhook.types';

@Controller('webhook/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Vérification du webhook exigée par Meta lors de sa configuration :
   * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
   */
  @Get()
  verifierWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Webhook WhatsApp vérifié avec succès par Meta.');
      res.status(200).send(challenge);
      return;
    }

    this.logger.warn('Échec de la vérification du webhook WhatsApp (token invalide).');
    res.status(403).send('Forbidden');
  }

  /**
   * Réception des messages entrants et des mises à jour de statut envoyés par Meta.
   * Protégé par la vérification de signature HMAC (désactivée en MOCK_MODE).
   */
  @Post()
  @HttpCode(200)
  @UseGuards(WhatsappSignatureGuard)
  async recevoirMessage(@Body() payload: WhatsappWebhookPayload): Promise<{ status: string }> {
    await this.whatsappService.traiterWebhook(payload);
    return { status: 'ok' };
  }
}
