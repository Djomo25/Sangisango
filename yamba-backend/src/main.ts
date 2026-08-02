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
