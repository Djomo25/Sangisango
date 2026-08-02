import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RendezVousService } from '../src/rendez-vous/rendez-vous.service';
import { ConversationsService } from '../src/conversations/conversations.service';

/**
 * Déclenche manuellement, en local, une méthode de service normalement
 * exécutée par un job @Cron planifié — sans attendre l'horaire réel.
 *
 * Usage :
 *   npm run cron:declencher -- RendezVousService envoyerRappelsRendezVous
 *   npm run cron:declencher -- ConversationsService appliquerReglesStatutAutomatique
 */
const SERVICES_DISPONIBLES = {
  RendezVousService,
  ConversationsService,
} as const;

async function main(): Promise<void> {
  const [nomService, nomMethode] = process.argv.slice(2);

  if (!nomService || !nomMethode || !(nomService in SERVICES_DISPONIBLES)) {
    console.error('Usage : npm run cron:declencher -- <NomDuService> <nomDeLaMethode>');
    console.error(`Services disponibles : ${Object.keys(SERVICES_DISPONIBLES).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });

  try {
    const ServiceClasse = SERVICES_DISPONIBLES[nomService as keyof typeof SERVICES_DISPONIBLES];
    const instance = app.get(ServiceClasse);
    const methode = (instance as unknown as Record<string, unknown>)[nomMethode];

    if (typeof methode !== 'function') {
      console.error(`Méthode "${nomMethode}" introuvable sur ${nomService}.`);
      process.exitCode = 1;
      return;
    }

    console.log(`--- Déclenchement manuel : ${nomService}.${nomMethode}() ---`);
    await methode.call(instance);
    console.log('--- Terminé ---');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
