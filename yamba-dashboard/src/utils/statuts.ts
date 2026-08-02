import type { StatutConversation, StatutRendezVous } from '../api/conversations';
import type { TonPill } from '../components/Pill';

export const STATUT_CONVERSATION_META: Record<StatutConversation, { label: string; ton: TonPill }> = {
  attention: { label: 'Nécessite intervention', ton: 'warn' },
  en_cours: { label: 'En cours', ton: 'info' },
  terminee: { label: 'Terminée', ton: 'ok' },
  abandon: { label: 'Abandonnée', ton: 'muted' },
};

export const STATUT_RENDEZ_VOUS_META: Record<StatutRendezVous, { label: string; ton: TonPill }> = {
  a_confirmer: { label: 'À confirmer', ton: 'warn' },
  confirme: { label: 'Confirmé', ton: 'ok' },
  annule: { label: 'Annulé', ton: 'muted' },
};
