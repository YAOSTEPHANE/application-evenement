# Frontend / backend — une seule source

Le dépôt ne duplique plus le code API ni `src/lib` dans `backend/`.

## Source de vérité

| Élément | Emplacement |
|--------|-------------|
| Routes API (`/api/*`) | `frontend/src/app/api/` |
| Logique métier (`@/lib/*`) | `frontend/src/lib/` |
| Schéma Prisma | `frontend/prisma/schema.prisma` |
| Proxy auth / CORS | `frontend/src/proxy.ts` |

## Rôle de `backend/`

Application Next.js **API-only** (port **3001** en local) pour tests ou déploiement séparé :

- `backend/src/app/api` → lien vers `frontend/src/app/api`
- `backend/src/proxy.ts` → lien vers `frontend/src/proxy.ts`
- `tsconfig` : `@/*` pointe vers `../frontend/src/*`

Après `npm install`, `postinstall` exécute `scripts/link-backend-to-frontend.mjs`.

## Commandes

```bash
npm run dev              # UI + API monolithe (port 3000)
npm run dev:backend        # API seule (port 3001), même code que le front
npm run link:backend       # Recréer les liens si besoin (Windows / clone)
```

**Ne plus utiliser** les anciens scripts `sync-api-to-backend`, `sync-libs-to-backend`, `sync-security-to-backend` (supprimés).

## Déploiement

Vercel ne build que **frontend** (`scripts/vercel-build.mjs`). En production, une seule app suffit sauf si vous hébergez l’API sur un service dédié (`NEXT_PUBLIC_API_BASE_URL` + rewrites dans `frontend/next.config.ts`).

## Validation

- Automatique : `npm run quality` (tests + `tsc` backend) ou `npm run check` (tests + build — arrêter les serveurs `dev` avant le build).
- Manuelle : [checklist-validation-manuelle.md](./checklist-validation-manuelle.md).
