export const JOURS_SEMAINE = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

/** Formate une date/heure en français, numérique et sans ambiguïté (ex: "mardi 24/07/2026 à 09h00"). */
export function formaterDateHeureFr(date: Date): string {
  const jour = JOURS_SEMAINE[date.getDay()];
  const jj = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const aaaa = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${jour} ${jj}/${mm}/${aaaa} à ${hh}h${min}`;
}
