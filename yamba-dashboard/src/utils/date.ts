export function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Heure si aujourd'hui, sinon jour abrégé (ex. "lun.") ou date courte au-delà d'une semaine. */
export function formatHeureOuJour(iso: string): string {
  const date = new Date(iso);
  const maintenant = new Date();
  const memeJour = date.toDateString() === maintenant.toDateString();
  if (memeJour) return formatHeure(iso);

  const diffJours = Math.floor((maintenant.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffJours < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatJourCourt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}
