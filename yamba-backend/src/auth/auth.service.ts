import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { JwtPayload } from './types/jwt-payload.type';

const DUREE_CODE_MINUTES = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly jwtService: JwtService,
  ) {}

  private get mockMode(): boolean {
    return this.configService.get<string>('MOCK_MODE') === 'true';
  }

  /**
   * Génère un code de connexion à 6 chiffres, l'enregistre avec une expiration
   * de 10 minutes et l'envoie au commerçant via WhatsApp. En MOCK_MODE, renvoie
   * aussi le code généré (jamais en production) pour tester le flux sans
   * recevoir de vrai message WhatsApp.
   */
  async demanderCode(telephone: string): Promise<{ code?: string }> {
    const commercant = await this.prisma.commercant.findUnique({ where: { telephone } });

    if (!commercant) {
      throw new NotFoundException('Aucun commerçant trouvé avec ce numéro de téléphone.');
    }

    const code = this.genererCode();
    const codeConnexionExpiration = new Date(Date.now() + DUREE_CODE_MINUTES * 60_000);

    await this.prisma.commercant.update({
      where: { id: commercant.id },
      data: { codeConnexion: code, codeConnexionExpiration },
    });

    await this.whatsappService.envoyerMessage(
      commercant.telephone,
      `Votre code de connexion au dashboard Yamba est : ${code} (valable ${DUREE_CODE_MINUTES} minutes).`,
    );

    if (this.mockMode) {
      this.logger.log(`[MOCK] Code de connexion pour ${telephone} : ${code}`);
      return { code };
    }

    return {};
  }

  /**
   * Vérifie le code fourni pour ce numéro de téléphone. Si valide et non
   * expiré, l'efface (usage unique) et retourne un JWT longue durée (90 jours).
   */
  async verifierCode(telephone: string, code: string): Promise<{ accessToken: string }> {
    const commercant = await this.prisma.commercant.findUnique({ where: { telephone } });

    if (!commercant) {
      throw new NotFoundException('Aucun commerçant trouvé avec ce numéro de téléphone.');
    }

    const codeValide =
      commercant.codeConnexion === code &&
      commercant.codeConnexionExpiration !== null &&
      commercant.codeConnexionExpiration.getTime() > Date.now();

    if (!codeValide) {
      throw new UnauthorizedException('Code invalide ou expiré.');
    }

    await this.prisma.commercant.update({
      where: { id: commercant.id },
      data: { codeConnexion: null, codeConnexionExpiration: null },
    });

    const payload: JwtPayload = { sub: commercant.id, telephone: commercant.telephone };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  private genererCode(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }
}
