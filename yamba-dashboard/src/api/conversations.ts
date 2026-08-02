import { apiFetch } from './client';

export type StatutConversation = 'en_cours' | 'terminee' | 'attention' | 'abandon';
export type ExpediteurMessage = 'client' | 'ia' | 'commercant';
export type StatutRendezVous = 'a_confirmer' | 'confirme' | 'annule';

export interface Message {
  id: string;
  conversationId: string;
  expediteur: ExpediteurMessage;
  contenu: string;
  createdAt: string;
}

export interface Creneau {
  id: string;
  dateHeure: string;
  dureeMinutes: number;
  statut: string;
}

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
}

export interface ConversationApercu {
  id: string;
  commercantId: string;
  clientTelephone: string;
  clientNom: string | null;
  statut: StatutConversation;
  canal: string;
  iaSuspendueJusqua: string | null;
  createdAt: string;
  updatedAt: string;
  dernierMessage: Message | null;
}

export interface ConversationDetail extends Omit<ConversationApercu, 'dernierMessage'> {
  messages: Message[];
  rendezVous: RendezVous | null;
}

export interface ListeConversations {
  data: ConversationApercu[];
  total: number;
  limit: number;
  offset: number;
}

export function listerConversations(
  statut: StatutConversation | undefined,
  limit: number,
  offset: number,
): Promise<ListeConversations> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (statut) params.set('statut', statut);
  return apiFetch(`/conversations?${params.toString()}`);
}

export function obtenirConversation(id: string): Promise<ConversationDetail> {
  return apiFetch(`/conversations/${id}`);
}

export function prendreLaMain(id: string): Promise<ConversationApercu> {
  return apiFetch(`/conversations/${id}/prendre-la-main`, { method: 'PATCH' });
}

export function terminerConversation(id: string): Promise<ConversationApercu> {
  return apiFetch(`/conversations/${id}/terminer`, { method: 'PATCH' });
}

export function ajouterCorrection(
  conversationId: string,
  messageOriginalId: string,
  suggestionCommercant: string,
): Promise<unknown> {
  return apiFetch(`/conversations/${conversationId}/corrections`, {
    method: 'POST',
    body: { messageOriginalId, suggestionCommercant },
  });
}

/** Nombre de conversations au statut "attention" (nécessite une intervention du commerçant). */
export async function compterConversationsAttention(): Promise<number> {
  const reponse = await listerConversations('attention', 1, 0);
  return reponse.total;
}
