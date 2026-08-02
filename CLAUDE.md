# Yamba

Assistant IA conversationnel WhatsApp pour commerçants informels à Kinshasa (RDC).

## Stack technique

- **Backend** : NestJS (Node.js/TypeScript)
- **Base de données** : PostgreSQL via Prisma ORM
- **IA conversationnelle** : API Claude (Anthropic), modèle `claude-sonnet-5`
- **WhatsApp** : WhatsApp Cloud API (Meta) — un numéro WhatsApp Business dédié par commerçant
- **Dashboard** : application web PWA, mobile-friendly
- **Hébergement cible** : Railway

## Modèle de données principal (5 tables)

- **commercants** : profil, services, FAQ, statut de vérification Meta, lien de conversion wa.me
- **conversations** : un fil par client, statut (`en_cours` / `terminee` / `attention` / `abandon`), rendez-vous lié
- **messages** : historique complet (client / IA / commerçant)
- **creneaux_disponibles** : disponibilités du commerçant, avec verrouillage anti double-booking
- **rendez_vous** : liés à un créneau et une conversation, avec statut (`a_confirmer` / `confirme` / `annule`)
- **corrections** : corrections proposées par le commerçant sur les réponses de l'IA (stockées, pas de ré-apprentissage auto en V1)

## Logique métier clé

- Un numéro WhatsApp = un commerçant (pas de numéro partagé)
- Prise de rendez-vous = validation manuelle par le commerçant (**Option B**) : l'IA propose et verrouille temporairement un créneau, le commerçant confirme depuis le dashboard
- Pas de synchronisation d'agenda temps réel en V1 — disponibilités saisies manuellement
- Auth dashboard commerçant : numéro de téléphone + code reçu par WhatsApp, session longue durée, **pas de mot de passe**
- **Hors scope V1** : Instagram/Messenger, paiements/Mobile Money, agenda temps réel, multi-utilisateurs dashboard

## Contraintes de développement

- Les clés API (Anthropic, Meta WhatsApp Cloud API) ne sont pas encore disponibles. Toujours prévoir un mode mock/simulation activable via une variable d'environnement (ex: `MOCK_MODE=true`) pour pouvoir développer et tester sans dépendre des vraies API.
- Toutes les clés sensibles doivent être en variables d'environnement (`.env`), jamais en dur dans le code.
