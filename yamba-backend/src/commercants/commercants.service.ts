import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { TonAssistant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { genererLienConversion } from '../common/lien-conversion.util';
import type { CreerCommercantDto } from './dto/creer-commercant.dto';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

// Sélection explicite : le code de connexion (même expiré) ne doit jamais
// sortir de la base vers une réponse HTTP.
const SELECTION_PROFIL_PUBLIC = {
  id: true,
  nom: true,
  secteur: true,
  commune: true,
  telephone: true,
  numeroWhatsapp: true,
  tonAssistant: true,
  horaires: true,
  servicesJson: true,
  faqJson: true,
  statutVerificationMeta: true,
  lienConversion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CommercantSelect;

export type ProfilCommercant = Prisma.CommercantGetPayload<{
  select: typeof SELECTION_PROFIL_PUBLIC;
}>;

export interface CommercantCree extends ProfilCommercant {
  accessToken: string;
}

export interface MiseAJourProfil {
  nom?: string;
  commune?: string;
  servicesJson?: unknown;
  faqJson?: unknown;
  horaires?: unknown;
  tonAssistant?: TonAssistant;
}

@Injectable()
export class CommercantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Crée un nouveau compte commerçant (endpoint public, avant toute
   * authentification) et le connecte immédiatement en retournant un JWT — pas
   * de flux démarrer-code/vérifier-code à ce stade, l'accompagnement des
   * commerçants pilotes rend cette étape superflue à la création du compte.
   *
   * MVP : telephone et numeroWhatsapp reçoivent la même valeur (un commerce
   * individuel utilise le même numéro pour se connecter au dashboard et pour
   * que ses clients lui écrivent) — à revoir si un jour ces deux usages
   * doivent être distingués.
   */
  async creer(donnees: CreerCommercantDto): Promise<CommercantCree> {
    const conflit = await this.prisma.commercant.findFirst({
      where: {
        OR: [{ telephone: donnees.telephone }, { numeroWhatsapp: donnees.telephone }],
      },
    });

    if (conflit) {
      throw new ConflictException('Ce numéro est déjà associé à un commerçant.');
    }

    let commercant: ProfilCommercant;
    try {
      commercant = await this.prisma.commercant.create({
        data: {
          nom: donnees.nom,
          secteur: donnees.secteur,
          commune: donnees.commune,
          telephone: donnees.telephone,
          numeroWhatsapp: donnees.telephone,
          ...(donnees.tonAssistant !== undefined && { tonAssistant: donnees.tonAssistant }),
          horaires: (donnees.horaires ?? {}) as Prisma.InputJsonValue,
          servicesJson: (donnees.servicesJson ?? []) as Prisma.InputJsonValue,
          faqJson: (donnees.faqJson ?? []) as Prisma.InputJsonValue,
          lienConversion: genererLienConversion(donnees.nom, donnees.telephone),
        },
        select: SELECTION_PROFIL_PUBLIC,
      });
    } catch (error) {
      // Filet de sécurité contre une (très improbable) course entre la
      // vérification ci-dessus et cet INSERT : la contrainte @unique de
      // Prisma sur telephone/numeroWhatsapp reste la garantie ultime.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce numéro est déjà associé à un commerçant.');
      }
      throw error;
    }

    const payload: JwtPayload = { sub: commercant.id, telephone: commercant.telephone };
    const accessToken = this.jwtService.sign(payload);

    return { ...commercant, accessToken };
  }

  /** Profil du commerçant connecté (jamais le code de connexion, même expiré). */
  async monProfil(commercantId: string): Promise<ProfilCommercant> {
    const commercant = await this.prisma.commercant.findUnique({
      where: { id: commercantId },
      select: SELECTION_PROFIL_PUBLIC,
    });

    if (!commercant) {
      throw new NotFoundException('Commerçant introuvable.');
    }

    return this.assurerLienConversionAJour(commercant);
  }

  /** Met à jour uniquement les champs fournis (services, FAQ, horaires, ton). */
  async mettreAJourProfil(
    commercantId: string,
    donnees: MiseAJourProfil,
  ): Promise<ProfilCommercant> {
    const commercantExiste = await this.prisma.commercant.findUnique({
      where: { id: commercantId },
    });

    if (!commercantExiste) {
      throw new NotFoundException('Commerçant introuvable.');
    }

    const commercant = await this.prisma.commercant.update({
      where: { id: commercantId },
      data: {
        ...(donnees.nom !== undefined && { nom: donnees.nom }),
        ...(donnees.commune !== undefined && { commune: donnees.commune }),
        ...(donnees.servicesJson !== undefined && {
          servicesJson: donnees.servicesJson as Prisma.InputJsonValue,
        }),
        ...(donnees.faqJson !== undefined && {
          faqJson: donnees.faqJson as Prisma.InputJsonValue,
        }),
        ...(donnees.horaires !== undefined && {
          horaires: donnees.horaires as Prisma.InputJsonValue,
        }),
        ...(donnees.tonAssistant !== undefined && { tonAssistant: donnees.tonAssistant }),
      },
      select: SELECTION_PROFIL_PUBLIC,
    });

    return this.assurerLienConversionAJour(commercant);
  }

  /** Lien de conversion wa.me du commerçant connecté (toujours à jour, voir assurerLienConversionAJour). */
  async lienConversion(commercantId: string): Promise<{ lienConversion: string }> {
    const profil = await this.monProfil(commercantId);
    return { lienConversion: profil.lienConversion };
  }

  /**
   * Recalcule lienConversion à partir de (nom, numeroWhatsapp) et le persiste
   * si la valeur stockée ne correspond plus à ce qui serait généré aujourd'hui.
   *
   * Comme il n'existe pas encore de flux "connexion WhatsApp" applicatif, un
   * numeroWhatsapp peut être défini directement en base (seed, Prisma Studio),
   * hors de tout code applicatif qu'on pourrait "brancher" pour régénérer le
   * lien à l'écriture. Cette vérification à la lecture (appelée par monProfil,
   * donc par tous les endpoints qui passent par lui) garantit que le lien
   * affiché au commerçant est toujours cohérent avec le numéro actuel, quelle
   * que soit la façon dont celui-ci a été renseigné ou modifié.
   */
  private async assurerLienConversionAJour(
    commercant: ProfilCommercant,
  ): Promise<ProfilCommercant> {
    const lienAttendu = genererLienConversion(commercant.nom, commercant.numeroWhatsapp);

    if (commercant.lienConversion === lienAttendu) {
      return commercant;
    }

    return this.prisma.commercant.update({
      where: { id: commercant.id },
      data: { lienConversion: lienAttendu },
      select: SELECTION_PROFIL_PUBLIC,
    });
  }
}
