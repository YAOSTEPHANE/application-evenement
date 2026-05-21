<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## CDC EVENT·RFID

Le cahier des charges (lexique, constats §2.1, objectifs §2.2, principe directeur) est une **référence développement** : voir `.cursor/rules/cdc-event-rfid.mdc` et `src/lib/cdc-*.ts`. Ne pas afficher ces textes documentaires dans le tableau de bord ni en blocs statiques dans l'UI.

**Modules CDC (1→8)** : feuille de route dans `src/lib/cdc-modules.ts` — implémenter **un module à la fois** (Identification RFID → Commandes → BE/BS/BT → Traçabilité → RH → Matrice validation → Alertes → Dashboard).
