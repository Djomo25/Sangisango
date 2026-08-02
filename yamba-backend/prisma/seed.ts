import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Génère quelques créneaux disponibles de test pour un commerçant.
 * Usage : npx prisma db seed -- <commercantId>
 * Sans argument, utilise le premier commerçant trouvé en base.
 */
async function main() {
  const commercantId = process.argv[2];

  const commercant = commercantId
    ? await prisma.commercant.findUnique({ where: { id: commercantId } })
    : await prisma.commercant.findFirst();

  if (!commercant) {
    throw new Error(
      commercantId
        ? `Aucun commerçant trouvé avec l'id "${commercantId}".`
        : "Aucun commerçant en base. Crée-en un d'abord, ou précise un id : npx prisma db seed -- <commercantId>",
    );
  }

  const maintenant = new Date();
  const heuresProposees = [9, 11, 14, 16];

  const creneaux = Array.from({ length: 6 }).map((_, index) => {
    const dateHeure = new Date(maintenant);
    dateHeure.setDate(dateHeure.getDate() + 1 + index);
    dateHeure.setHours(heuresProposees[index % heuresProposees.length], 0, 0, 0);

    return {
      commercantId: commercant.id,
      dateHeure,
      dureeMinutes: 60,
      statut: 'disponible' as const,
    };
  });

  await prisma.creneauDisponible.createMany({ data: creneaux });

  console.log(`${creneaux.length} créneaux disponibles créés pour "${commercant.nom}" (${commercant.id}) :`);
  for (const creneau of creneaux) {
    console.log(`  - ${creneau.dateHeure.toLocaleString('fr-FR')}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
