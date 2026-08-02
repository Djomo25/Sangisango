import { BadRequestException } from '@nestjs/common';

export const PERIODES_VALIDES = ['jour', 'semaine', 'a-venir'] as const;
export type Periode = (typeof PERIODES_VALIDES)[number];

export interface BornesPeriode {
  gte: Date;
  lte?: Date;
}

/** Valide le query param `periode` ; par défaut "a-venir" si absent. */
export function validerPeriode(periodeRaw: string | undefined): Periode {
  if (periodeRaw === undefined) {
    return 'a-venir';
  }
  if (!PERIODES_VALIDES.includes(periodeRaw as Periode)) {
    throw new BadRequestException(
      `Période invalide. Valeurs possibles : ${PERIODES_VALIDES.join(', ')}.`,
    );
  }
  return periodeRaw as Periode;
}

/**
 * Bornes de date correspondant à la période :
 * - "jour" : aujourd'hui uniquement (00:00 à 23:59:59 locale)
 * - "semaine" : les 7 prochains jours (fenêtre glissante, pas semaine calendaire)
 * - "a-venir" : tout le futur, sans limite haute
 */
export function bornesPourPeriode(periode: Periode): BornesPeriode {
  const maintenant = new Date();

  if (periode === 'jour') {
    const gte = new Date(maintenant);
    gte.setHours(0, 0, 0, 0);
    const lte = new Date(maintenant);
    lte.setHours(23, 59, 59, 999);
    return { gte, lte };
  }

  if (periode === 'semaine') {
    return { gte: maintenant, lte: new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }

  return { gte: maintenant };
}
