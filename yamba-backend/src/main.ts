// Polyfill : sur Node 18 (utilisé par certains hébergeurs comme Railway),
// `globalThis.crypto` (Web Crypto API) n'est pas exposé sans le flag
// --experimental-global-webcrypto. @nestjs/schedule appelle `crypto.randomUUID()`
// en supposant ce global présent (nécessaire dès qu'un @Cron() est déclaré),
// ce qui plante au démarrage avec "ReferenceError: crypto is not defined".
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  // @ts-expect-error -- webcrypto n'est pas typé strictement comme `Crypto` du DOM.
  globalThis.crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true expose req.rawBody (Buffer), nécessaire pour vérifier la
  // signature X-Hub-Signature-256 des webhooks Meta sur le corps brut exact.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Le dashboard (yamba-dashboard) est servi sur une origine distincte
  // (Vite dev server / hébergement statique) et appelle cette API via fetch
  // avec un Bearer token (pas de cookies) : pas de risque CSRF à ouvrir CORS.
  app.enableCors();
  // Ne valide/transforme que les DTO définis comme classes avec des
  // décorateurs class-validator (ex: CreerCommercantDto) : les anciens DTO du
  // projet, de simples interfaces TypeScript sans métadonnées runtime, ne sont
  // pas concernés et continuent de passer sans validation, comme avant.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
