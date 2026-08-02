export interface MettreAJourProfilDto {
  nom?: string;
  commune?: string;
  servicesJson?: unknown;
  faqJson?: unknown;
  horaires?: unknown;
  tonAssistant?: 'chaleureux' | 'professionnel' | 'direct';
}
