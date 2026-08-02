import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { CreneauDisponible, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parserPagination } from '../common/pagination.util';
import { bornesPourPeriode, validerPeriode } from '../common/periode.util';
import type { CreneauInputDto } from './dto/creer-creneaux.dto';

type ClientPrisma = PrismaService | Prisma.TransactionClient;

// Durée par défaut d'un créneau créé manuellement, si non précisée.
const DUREE_CRENEAU_DEFAUT_MINUTES = 60;

export interface ListeCreneaux {
  data: CreneauDisponible[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class CreneauxService {
  private readonly logger = new Logger(CreneauxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste les créneaux du commerçant connecté (tous statuts confondus), triés
   * par date croissante, filtrés par période et paginés.
   */
  async lister(
    commercantId: string,
    periodeRaw: string | undefined,
    limitRaw: string | undefined,
    offsetRaw: string | undefined,
  ): Promise<ListeCreneaux> {
    const periode = validerPeriode(periodeRaw);
    const { gte, lte } = bornesPourPeriode(periode);
    const { limit, offset } = parserPagination(limitRaw, offsetRaw);

    const where = { commercantId, dateHeure: { gte, ...(lte ? { lte } : {}) } };

    const [data, total] = await Promise.all([
      this.prisma.creneauDisponible.findMany({
        where,
        orderBy: { dateHeure: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.creneauDisponible.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  /**
   * Crée un ou plusieurs créneaux disponibles pour le commerçant connecté
   * (ajout manuel de disponibilités depuis le dashboard).
   */
  async creerPlusieurs(
    commercantId: string,
    creneauxInput: CreneauInputDto[],
  ): Promise<CreneauDisponible[]> {
    if (!creneauxInput || creneauxInput.length === 0) {
      throw new BadRequestException('Fournir au moins un créneau dans "creneaux".');
    }

    const donnees = creneauxInput.map((input) => {
      const dateHeure = new Date(input.dateHeure);
      if (Number.isNaN(dateHeure.getTime())) {
        throw new BadRequestException(`Date invalide : "${input.dateHeure}".`);
      }
      if (dateHeure.getTime() <= Date.now()) {
        throw new BadRequestException('La date du créneau doit être dans le futur.');
      }

      const dureeMinutes = input.dureeMinutes ?? DUREE_CRENEAU_DEFAUT_MINUTES;
      if (dureeMinutes <= 0) {
        throw new BadRequestException('La durée du créneau doit être positive.');
      }

      return {
        commercantId,
        dateHeure,
        dureeMinutes,
        statut: 'disponible' as const,
      };
    });

    return this.prisma.creneauDisponible.createManyAndReturn({ data: donnees });
  }

  /**
   * Supprime un créneau du commerçant connecté. Refuse si le créneau n'est
   * plus "disponible" (verrouillé ou réservé par un rendez-vous en cours).
   */
  async supprimer(commercantId: string, creneauId: string): Promise<void> {
    const creneau = await this.prisma.creneauDisponible.findFirst({
      where: { id: creneauId, commercantId },
    });

    if (!creneau) {
      throw new NotFoundException('Créneau introuvable.');
    }

    if (creneau.statut !== 'disponible') {
      throw new ConflictException(
        `Impossible de supprimer ce créneau : il est actuellement "${creneau.statut}". Seul un créneau "disponible" peut être supprimé.`,
      );
    }

    await this.prisma.creneauDisponible.delete({ where: { id: creneauId } });
  }

  /**
   * Retourne le créneau disponible le plus proche de la date souhaitée pour ce
   * commerçant (avant ou après), ou null si aucun créneau n'est disponible.
   */
  async proposerCreneau(commercantId: string, dateApprox: Date): Promise<CreneauDisponible | null> {
    const [apres, avant] = await Promise.all([
      this.prisma.creneauDisponible.findFirst({
        where: { commercantId, statut: 'disponible', dateHeure: { gte: dateApprox } },
        orderBy: { dateHeure: 'asc' },
      }),
      this.prisma.creneauDisponible.findFirst({
        where: { commercantId, statut: 'disponible', dateHeure: { lt: dateApprox } },
        orderBy: { dateHeure: 'desc' },
      }),
    ]);

    if (!apres) return avant;
    if (!avant) return apres;

    const diffApres = Math.abs(apres.dateHeure.getTime() - dateApprox.getTime());
    const diffAvant = Math.abs(avant.dateHeure.getTime() - dateApprox.getTime());
    return diffApres <= diffAvant ? apres : avant;
  }

  /**
   * Verrouille temporairement un créneau (anti double-booking) : la mise à jour
   * n'a d'effet que si le créneau est encore "disponible" au moment exact de
   * l'UPDATE — voir l'explication du mécanisme dans la réponse associée.
   * Accepte un client de transaction Prisma optionnel pour être appelé dans le
   * cadre d'une opération atomique plus large (ex: création d'un rendez-vous).
   */
  async verrouillerCreneau(
    creneauId: string,
    dureeVerrouillageMinutes: number,
    client: ClientPrisma = this.prisma,
  ): Promise<CreneauDisponible> {
    const verrouilleJusqua = new Date(Date.now() + dureeVerrouillageMinutes * 60_000);

    const { count } = await client.creneauDisponible.updateMany({
      where: { id: creneauId, statut: 'disponible' },
      data: { statut: 'verrouille', verrouilleJusqua },
    });

    if (count === 0) {
      throw new ConflictException("Ce créneau n'est plus disponible.");
    }

    return client.creneauDisponible.findUniqueOrThrow({ where: { id: creneauId } });
  }

  /**
   * Libère automatiquement les créneaux verrouillés dont le délai de
   * confirmation a expiré sans qu'un rendez-vous n'ait été confirmé.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async libererCreneauxExpires(): Promise<void> {
    const { count } = await this.prisma.creneauDisponible.updateMany({
      where: { statut: 'verrouille', verrouilleJusqua: { lt: new Date() } },
      data: { statut: 'disponible', verrouilleJusqua: null },
    });

    if (count > 0) {
      this.logger.log(`${count} créneau(x) libéré(s) après expiration du verrou.`);
    }
  }
}
