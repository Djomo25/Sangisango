import { apiFetch } from './client';

export type TonAssistant = 'chaleureux' | 'professionnel' | 'direct';

export interface Service {
  nom: string;
  prix?: number | string;
}

export interface FaqItem {
  question: string;
  reponse: string;
}

/** Clé = nom du jour en minuscules (ex. "lundi"), valeur = plage horaire libre (ex. "08h30-18h00") ou "Fermé". */
export type Horaires = Record<string, string>;

export interface Commercant {
  id: string;
  nom: string;
  secteur: string;
  commune: string;
  telephone: string;
  numeroWhatsapp: string;
  tonAssistant: TonAssistant;
  horaires: Horaires;
  servicesJson: Service[];
  faqJson: FaqItem[];
  statutVerificationMeta: string;
  lienConversion: string;
  createdAt: string;
  updatedAt: string;
}

export interface MiseAJourProfil {
  nom?: string;
  commune?: string;
  servicesJson?: Service[];
  faqJson?: FaqItem[];
  horaires?: Horaires;
  tonAssistant?: TonAssistant;
}

export function monProfil(): Promise<Commercant> {
  return apiFetch('/commercant/moi');
}

export function mettreAJourProfil(donnees: MiseAJourProfil): Promise<Commercant> {
  return apiFetch('/commercant/moi', { method: 'PATCH', body: donnees });
}

export function obtenirLienConversion(): Promise<{ lienConversion: string }> {
  return apiFetch('/commercant/moi/lien-conversion');
}

export interface CreerCommercantPayload {
  nom: string;
  secteur: string;
  commune: string;
  telephone: string;
  tonAssistant?: TonAssistant;
  horaires?: Horaires;
  servicesJson?: Service[];
  faqJson?: FaqItem[];
}

export interface CommercantCree extends Commercant {
  accessToken: string;
}

/** Endpoint public : crée le compte et connecte immédiatement (JWT dans la réponse). */
export function creerCommercant(payload: CreerCommercantPayload): Promise<CommercantCree> {
  return apiFetch('/commercants', { method: 'POST', body: payload });
}
