/**
 * Génère le lien de conversion wa.me d'un commerçant : un clic ouvre WhatsApp
 * avec un message d'accueil pré-rempli (côté client), personnalisé avec le nom
 * du commerce.
 *
 * Le numéro est nettoyé (chiffres uniquement) car wa.me exige un format E.164
 * sans "+", espaces, tirets ou parenthèses — important une fois que
 * numeroWhatsapp proviendra d'un vrai numéro WhatsApp Business Meta (le champ
 * "display_phone_number" renvoyé par Meta est souvent formaté avec des espaces).
 */
export function genererLienConversion(nom: string, numeroWhatsapp: string): string {
  const numeroNettoye = numeroWhatsapp.replace(/[^0-9]/g, '');
  const message = `Bonjour ${nom} ! Je souhaite avoir plus d'informations sur vos services.`;
  return `https://wa.me/${numeroNettoye}?text=${encodeURIComponent(message)}`;
}
