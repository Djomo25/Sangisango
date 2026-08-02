# Yamba Backend

Assistant IA conversationnel WhatsApp pour commerçants informels à Kinshasa (RDC).

Backend NestJS (TypeScript) — voir le `CLAUDE.md` à la racine du projet pour le contexte produit complet (modèle de données, logique métier, contraintes V1).

## Stack

- **Framework** : NestJS 11
- **ORM** : Prisma 6 (`prisma-client-js`) + PostgreSQL
- **Config** : `@nestjs/config` (variables d'environnement centralisées via `ConfigService`)
- **Base de données locale** : PostgreSQL 16 via Docker Compose

## Structure

Un module par domaine métier, généré vide (module + controller + service, sans implémentation) :

```
src/
├── prisma/         # PrismaService/PrismaModule partagé (module global)
├── commercants/
├── conversations/
├── messages/
├── creneaux/
├── rendez-vous/
├── whatsapp/
├── ia/
└── auth/
```

## Installation

```bash
npm install
```

Copier `.env.example` vers `.env` et renseigner les valeurs (les clés Anthropic/WhatsApp peuvent rester vides tant que `MOCK_MODE=true`) :

```bash
cp .env.example .env
```

## Démarrer la base de données locale

```bash
npm run db:up      # démarre PostgreSQL (docker compose up -d)
npm run db:down     # arrête le conteneur
```

⚠️ Le conteneur PostgreSQL expose le port **5433** sur l'hôte (et non 5432) — voir la section "Problèmes rencontrés" ci-dessous pour la raison.

## Prisma

```bash
npm run prisma:generate   # régénère le client Prisma après une modif de schema.prisma
npm run prisma:migrate    # applique les migrations en dev
npm run prisma:studio     # ouvre Prisma Studio
```

## Lancer l'application

```bash
npm run start:dev    # mode watch (dev)
npm run build && npm run start:prod   # mode production
```

L'API écoute sur `http://localhost:3000`.

## Endpoints de l'API

`🔒` = protégé par `JwtAuthGuard` (header `Authorization: Bearer <token>`, scopé au commerçant connecté). Le reste est public.

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/commercants` | Crée un compte commerçant et retourne un JWT immédiatement (pas de flux code/vérification à la création) |
| `POST` | `/auth/demander-code` | Envoie un code de connexion par WhatsApp (renvoyé directement dans la réponse si `MOCK_MODE=true`) |
| `POST` | `/auth/verifier-code` | Vérifie le code et retourne un JWT (90 jours) |
| 🔒 `GET` | `/commercant/moi` | Profil du commerçant connecté |
| 🔒 `PATCH` | `/commercant/moi` | Met à jour nom/commune/horaires/ton/services/FAQ |
| 🔒 `GET` | `/commercant/moi/lien-conversion` | Lien wa.me de conversion (toujours à jour) |
| 🔒 `GET` | `/conversations` | Liste des conversations, filtrable par `?statut=` |
| 🔒 `GET` | `/conversations/:id` | Détail (historique complet + rendez-vous lié) |
| 🔒 `PATCH` | `/conversations/:id/prendre-la-main` | Passe en `en_cours` et suspend l'IA 60 min |
| 🔒 `PATCH` | `/conversations/:id/terminer` | Marque manuellement la conversation `terminee` |
| 🔒 `POST` | `/conversations/:id/corrections` | Propose une meilleure réponse sur un message IA |
| 🔒 `GET` | `/creneaux` | Liste des créneaux, filtrable par `?periode=` |
| 🔒 `POST` | `/creneaux` | Crée un ou plusieurs créneaux disponibles |
| 🔒 `DELETE` | `/creneaux/:id` | Supprime un créneau (doit être `disponible`) |
| 🔒 `GET` | `/rendez-vous` | Liste des rendez-vous, filtrable par `?periode=` |
| 🔒 `POST` | `/rendez-vous` | Crée un rendez-vous "à confirmer" et verrouille le créneau |
| 🔒 `PATCH` | `/rendez-vous/:id/confirmer` | Confirme le rendez-vous (créneau → `reserve`) |
| 🔒 `PATCH` | `/rendez-vous/:id/annuler` | Annule le rendez-vous (créneau → `disponible`) |
| `GET` | `/webhook/whatsapp` | Vérification du webhook par Meta (`hub.challenge`) |
| `POST` | `/webhook/whatsapp` | Réception des messages WhatsApp entrants (signature Meta vérifiée) |

## Jobs planifiés (cron)

Certaines règles métier tournent en tâche de fond via `@nestjs/schedule` (`@Cron`), sans attendre une requête HTTP :

| Job (`name`) | Service.méthode | Fréquence | Rôle |
| --- | --- | --- | --- |
| `rappelsRendezVous` | `RendezVousService.envoyerRappelsRendezVous` | tous les jours à 8h | Rappel WhatsApp pour les rendez-vous confirmés dans les 24h |
| `reglesStatutConversations` | `ConversationsService.appliquerReglesStatutAutomatique` | tous les jours à 1h | Passe une conversation en `terminee` (rendez-vous confirmé passé) ou `abandon` (inactive 2j+ sans rendez-vous actif) |

En local, pas besoin d'attendre l'horaire réel : `scripts/declencher-cron.ts` démarre un contexte Nest applicatif isolé (sans ouvrir le port HTTP), résout le service demandé et appelle directement sa méthode.

```bash
npm run cron:declencher -- RendezVousService envoyerRappelsRendezVous
npm run cron:declencher -- ConversationsService appliquerReglesStatutAutomatique
```

## Qualité de code

```bash
npm run lint      # ESLint (flat config) + Prettier
npm run format    # Prettier seul
npm run test       # Jest (unit)
npm run test:e2e   # Jest (e2e)
```

---

## Problèmes rencontrés et résolutions

### 1. Prisma 7 installé par défaut au lieu de Prisma 6

**Symptôme** : `npx prisma init` a installé Prisma 7.9.0, qui génère un client Prisma **ESM-only** dans un dossier custom (`generated/prisma` au lieu de `node_modules/@prisma/client`) et installe automatiquement des dossiers de "skills" agent (`.claude/skills`, `.windsurf/skills`, `.agents/skills`, `skills-lock.json`) non désirés dans le repo.

**Résolution** : désinstallation de Prisma 7, réinstallation figée sur `prisma@6.19.3` / `@prisma/client@6.19.3` (générateur classique `prisma-client-js`, CommonJS, compatible directement avec NestJS). Les dossiers de skills et `prisma.config.ts` générés par la v7 ont été supprimés.

### 2. `DATABASE_URL` était `undefined` au runtime malgré un `.env` correct

**Symptôme** : `PrismaService` levait `PrismaClientInitializationError` avec des identifiants `(not available)`. Pourtant `prisma generate` / `prisma migrate` fonctionnaient normalement, et un test isolé (`node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"`) affichait la bonne valeur.

**Cause** : la CLI Prisma charge `.env` elle-même via `dotenv`, mais rien ne le faisait pour l'application NestJS compilée — `process.env.DATABASE_URL` restait `undefined` au démarrage réel de l'app.

**Résolution** :
- Installation de `@nestjs/config`.
- Ajout de `ConfigModule.forRoot({ isGlobal: true })` en premier import dans `app.module.ts`.
- `PrismaService` injecte désormais `ConfigService` et passe explicitement `datasourceUrl` au constructeur de `PrismaClient`, plutôt que de compter sur une lecture implicite de `process.env` — cette convention sera réutilisée par les futurs modules ayant besoin de variables d'environnement (`whatsapp`, `ia`, `auth`).

### 3. Authentification Postgres refusée malgré des identifiants corrects (le vrai bug)

**Symptôme** : après la correction ci-dessus, `DATABASE_URL` était bien résolue avec la bonne valeur (confirmé par logs de debug), mais la connexion échouait toujours avec :
```
PrismaClientInitializationError: Authentication failed against database server,
the provided database credentials for `(not available)` are not valid. (P1000)
```
Le conteneur `yamba-postgres` tournait, et `docker exec -it yamba-postgres psql -U yamba -d yamba` fonctionnait — ce qui semblait indiquer des identifiants corrects.

**Diagnostic** :
- Un `new PrismaClient()` brut, en dehors de NestJS, échouait à l'identique → le bug n'était pas dans le code applicatif.
- Un client `pg` (node-postgres) brut donnait le vrai message serveur : *authentification par mot de passe échouée pour l'utilisateur « yamba »* — un vrai rejet PostgreSQL, pas un artefact Prisma.
- Aucune tentative de connexion n'apparaissait dans les logs du conteneur `yamba-postgres`, même après un test qui échouait côté client → la connexion n'atteignait pas ce conteneur.
- `Get-NetTCPConnection -LocalPort 5432` (PowerShell) a révélé **deux processus distincts** en écoute sur le port 5432 : `com.docker.backend.exe` (le forwarder Docker légitime, IPv6) et un **processus `postgres` natif Windows** (PID inconnu, pas un service Windows enregistré, IPv4).

**Cause réelle** : `docker exec -it ... psql` passe par le socket Unix local à l'intérieur du conteneur, qui utilise l'authentification `trust` (aucune vérification de mot de passe) — ce test "réussissait" indépendamment du mot de passe réel. Une vraie connexion TCP depuis l'hôte (comme le fait Prisma) passait par la règle `scram-sha-256`, et `localhost:5432` était intercepté par ce second serveur PostgreSQL natif inconnu, sans rapport avec le conteneur Docker.

**Résolution** : plutôt que d'arrêter un processus système inconnu (potentiellement utilisé par un autre outil), le conteneur PostgreSQL a été remappé sur le **port hôte 5433** dans `docker-compose.yml` et `DATABASE_URL` mis à jour en conséquence dans `.env` / `.env.example`. Validé par un test de connexion `pg` brut réussi sur le port 5433, puis par un démarrage complet de `npm run start:dev` sans erreur.

⚠️ **Point ouvert** : l'origine de ce processus PostgreSQL natif écoutant sur le port 5432 (0.0.0.0) sur cette machine Windows n'a pas été investiguée plus loin — à vérifier si besoin (autre installation locale de PostgreSQL, outil qui en embarque un, etc.).
