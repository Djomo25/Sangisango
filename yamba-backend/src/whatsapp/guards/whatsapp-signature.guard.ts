import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Vérifie l'en-tête X-Hub-Signature-256 envoyé par Meta pour authentifier
 * l'origine des requêtes webhook (HMAC SHA-256 du corps brut avec l'App Secret).
 * Désactivé en MOCK_MODE pour permettre les tests locaux sans compte Meta.
 */
@Injectable()
export class WhatsappSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WhatsappSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    if (mockMode) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signatureHeader = request.headers['x-hub-signature-256'];
    const appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');

    if (!appSecret) {
      this.logger.error(
        'WHATSAPP_APP_SECRET manquant : impossible de vérifier la signature du webhook.',
      );
      throw new UnauthorizedException('Configuration du webhook incomplète');
    }

    if (!signatureHeader || typeof signatureHeader !== 'string' || !request.rawBody) {
      this.logger.warn(
        `Webhook rejeté : en-tête X-Hub-Signature-256 absent (rawBody présent : ${!!request.rawBody}).`,
      );
      throw new UnauthorizedException('Signature de webhook manquante');
    }

    const expectedSignature = `sha256=${createHmac('sha256', appSecret).update(request.rawBody).digest('hex')}`;

    const receivedBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    const isValid =
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer);

    if (!isValid) {
      this.logger.warn(
        'Webhook rejeté : signature invalide (WHATSAPP_APP_SECRET ne correspond probablement pas à celui de Meta).',
      );
      throw new UnauthorizedException('Signature de webhook invalide');
    }

    return true;
  }
}
