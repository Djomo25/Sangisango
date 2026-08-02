# Déploiement Railway — Yamba

## Fichiers de config

- **`railway.json`** : builder Nixpacks, `buildCommand: npm run build`, `startCommand: npm run start:prod:migrate`.
- **`package.json`** :
  - `postinstall: prisma generate` — régénère le client Prisma avec le bon binaire pour la plateforme de build Railway (indépendant de ta machine locale).
  - `start:prod:migrate: prisma migrate deploy && node dist/main` — applique les migrations en attente puis démarre le serveur. C'est la commande de démarrage utilisée en production (`migrate deploy`, jamais `migrate dev` qui est interactif et pensé pour le développement).

Aucun de ces fichiers ne référence le port 5433 ni `docker-compose.yml` : Railway fournit son propre `DATABASE_URL` managé (voir ci-dessous), et `PORT` est déjà géré dynamiquement dans `src/main.ts` (`process.env.PORT ?? 3000`).

## Connexion PostgreSQL managée Railway

1. Dans le projet Railway, ajoute un plugin **PostgreSQL** ("+ New" → "Database" → "Add PostgreSQL").
2. Railway injecte automatiquement la variable `DATABASE_URL` dans le service backend **si tu la référence** via `${{Postgres.DATABASE_URL}}` dans les variables du service (ou en cochant "Add variable reference" dans l'UI). Tu n'as rien à saisir manuellement — surtout pas l'URL locale `localhost:5433` de ton `.env` de dev.
3. Au premier déploiement, `prisma migrate deploy` (exécuté par `start:prod:migrate`) crée le schéma sur cette base managée à partir des migrations versionnées dans `prisma/migrations/`.

## Checklist des variables d'environnement Railway

À configurer dans l'onglet **Variables** du service Railway avant le premier déploiement :

| Variable | Statut | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ Auto-fournie par Railway | Référence le plugin PostgreSQL (`${{Postgres.DATABASE_URL}}`), ne pas la définir manuellement. |
| `PORT` | ✅ Auto-fournie par Railway | Ne pas la définir toi-même, Railway l'injecte au runtime. |
| `MOCK_MODE` | ⚠️ **À définir à `false`** | En local elle vaut `true`. En production, doit être `false` dès que les vraies clés Anthropic/Meta sont configurées, sinon l'IA et l'envoi WhatsApp resteront simulés. |
| `JWT_SECRET` | ⚠️ **À générer, jamais réutiliser le dev** | Ne pas copier `"dev-secret-change-me"` (ou équivalent) du `.env` local. Génère un secret fort dédié, ex. `openssl rand -base64 48`. |
| `ANTHROPIC_API_KEY` | ❌ **À obtenir** | Clé API Anthropic (console.anthropic.com). Pas encore disponible d'après le contexte projet. |
| `WHATSAPP_CLOUD_API_TOKEN` | ❌ **À obtenir** | Token d'accès Meta WhatsApp Cloud API (Meta for Developers, app Business). |
| `WHATSAPP_PHONE_NUMBER_ID` | ❌ **À obtenir** | ID du numéro WhatsApp Business, fourni par Meta après config de l'app. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ❌ **À définir** | Chaîne arbitraire que tu choisis toi-même et que tu ressaisis dans la config du webhook Meta (pas une clé Meta — tu peux la générer dès maintenant, ex. `openssl rand -hex 24`). |
| `WHATSAPP_APP_SECRET` | ❌ **À obtenir** | App Secret Meta (onglet "Paramètres de base" de l'app), sert à valider la signature `X-Hub-Signature-256` des webhooks. Requis dès que `MOCK_MODE=false`. |

**Résumé** :
- Déjà en ta possession / générables toi-même sans dépendance externe : `JWT_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (à générer), `MOCK_MODE` (à mettre à `false`).
- Encore à obtenir auprès des fournisseurs : `ANTHROPIC_API_KEY` (Anthropic), `WHATSAPP_CLOUD_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_APP_SECRET` (Meta).
- Auto-gérées par Railway, à ne jamais définir en dur : `DATABASE_URL`, `PORT`.

## Vérification anti-fuite de config locale

- `railway.json` : aucune référence à un port, une URL ou un identifiant local.
- `package.json` : scripts `build`/`start:prod:migrate` génériques, aucun port ni URL en dur.
- `.env.example` : documente `localhost:5433` uniquement comme gabarit de dev (commentaire explicite sur le conflit de port local) — ce fichier n'est jamais lu par Railway, qui n'utilise que les variables définies dans son propre dashboard.
- `docker-compose.yml` : usage exclusivement local (`npm run db:up`), jamais invoqué par Railway.

Tant que `MOCK_MODE=true` reste actif sur Railway, le déploiement peut être testé de bout en bout (webhook, rendez-vous, auth) sans qu'aucune des 4 clés Anthropic/Meta ne soit encore obtenue.
