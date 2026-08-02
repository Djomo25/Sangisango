import type { Commercant } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Génère un suffixe numérique de 10 chiffres (8 derniers chiffres du timestamp,
 * qui varient à chaque ms, + 2 chiffres aléatoires) pour des champs uniques de
 * test. Longueur fixe pour ne jamais être tronqué par le `.slice(0, 15)` des
 * numéros de téléphone, ce qui ferait collisionner deux commerçants créés
 * dans la même seconde.
 */
function suffixeUnique(): string {
  const timestamp = Date.now().toString().slice(-8);
  const alea = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0');
  return `${timestamp}${alea}`;
}

/**
 * Crée un commerçant de test avec des champs uniques (telephone, numeroWhatsapp)
 * garantis non collisionnants entre exécutions/fichiers de test.
 */
export async function creerCommercantTest(
  prisma: PrismaService,
  overrides: Partial<Pick<Commercant, 'nom' | 'telephone' | 'numeroWhatsapp'>> = {},
): Promise<Commercant> {
  const suffixe = suffixeUnique();

  return prisma.commercant.create({
    data: {
      nom: overrides.nom ?? `Commerce Test ${suffixe}`,
      secteur: 'test',
      commune: 'Kinshasa',
      telephone: overrides.telephone ?? `24390${suffixe}`.slice(0, 15),
      numeroWhatsapp: overrides.numeroWhatsapp ?? `24391${suffixe}`.slice(0, 15),
      horaires: {},
      servicesJson: [{ nom: 'Service Test', prix: 5000 }],
      faqJson: [],
      lienConversion: '',
    },
  });
}

/** Numéro de téléphone client unique pour un test (évite les collisions entre tests). */
export function numeroClientTest(): string {
  return `24381${suffixeUnique()}`.slice(0, 15);
}
