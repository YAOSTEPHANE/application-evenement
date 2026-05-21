# Sécurité & qualité — StockEvent / CDC EVENT·RFID

## Variables obligatoires (production)

| Variable | Usage |
|----------|--------|
| `DATABASE_URL` | MongoDB (Prisma) |
| `AUTH_JWT_SECRET` | Cookies de session (≥ 32 caractères) |
| `SEED_SECRET` | `POST /api/setup/seed` — `Authorization: Bearer …` |
| `CDC_CRON_SECRET` | `POST /api/cdc/alerts/run` — cron planifié |
| `ALLOW_LEGACY_API_HEADERS` | `false` en prod (désactive `x-actor-id` sans JWT) |

## Idempotence (mobile offline)

Les `POST` terrain / bons / scans acceptent le header **`Idempotency-Key`** (ou `idempotency-key`).
La réponse est mise en cache 7 jours par organisation (modèle `ApiIdempotencyRecord`).

Après mise à jour du schéma Prisma :

```bash
cd frontend
npm run prisma:generate
npm run prisma:push
```

## Vérifications locales

```bash
npm run quality
```

Enchaîne : schéma Prisma, tests frontend + mobile, `tsc` backend.

## Architecture API

- **Frontend** : app Next.js + routes `/api/*` (source de vérité).
- **Backend** : `src/app/api` en lien vers le frontend ; `proxy.ts` symlink ; libs auth copiées via `npm run sync:security`.

## Principes CDC

Voir `.cursor/rules/cdc-event-rfid.mdc` — pas de texte CDC dans le dashboard ; traçabilité RFID + bons signés.
