import { apiFetch } from './client';
import type { Creneau, StatutRendezVous } from './conversations';

export type Periode = 'jour' | 'semaine' | 'a-venir';

export interface RendezVous {
  id: string;
  conversationId: string;
  creneauId: string;
  service: string;
  prix: number | null;
  statut: StatutRendezVous;
  rappelEnvoye: boolean;
  createdAt: string;
  creneau: Creneau;
  conversation: {
    id: string;
    clientNom: string | null;
    clientTelephone: string;
  };
}

export interface ListeRendezVous {
  data: RendezVous[];
  total: number;
  limit: number;
  offset: number;
}

export function listerRendezVous(
  periode: Periode,
  limit: number,
  offset: number,
): Promise<ListeRendezVous> {
  const params = new URLSearchParams({
    periode,
    limit: String(limit),
    offset: String(offset),
  });
  return apiFetch(`/rendez-vous?${params.toString()}`);
}

export function confirmerRendezVous(id: string): Promise<RendezVous> {
  return apiFetch(`/rendez-vous/${id}/confirmer`, { method: 'PATCH' });
}

export function annulerRendezVous(id: string): Promise<RendezVous> {
  return apiFetch(`/rendez-vous/${id}/annuler`, { method: 'PATCH' });
}
