# Checklist validation manuelle — EVENT·RFID

À exécuter après `npm install`, `npm run test` et `npm run build` OK.  
Prérequis : MongoDB (`DATABASE_URL`), seed si base vide (`npm run seed`).

## Préparation

- [ ] `npm run dev` (frontend, port **3000**) — ou `dev:frontend` + `dev:backend` (3001) si API séparée
- [ ] `GET /api/health` → `status: "ok"`
- [ ] Compte de test (admin / magasinier selon seed)

---

## 1. Authentification (web)

- [ ] Connexion `/connexion` — identifiant + mot de passe
- [ ] Déconnexion
- [ ] Session conservée après rechargement
- [ ] 2FA si activé sur le compte

---

## 2. Tableau de bord & navigation

- [ ] Accueil charge KPIs / listes sans erreur console
- [ ] Sidebar : chaque module CDC s’ouvre (RFID, Commandes, Mouvements, Traçabilité, RH, Validation, Alertes, Dashboard)
- [ ] Actualiser / filtres répondent

---

## 3. Catalogue & stock

- [ ] Liste articles, création / édition article
- [ ] Catégories (arbre admin)
- [ ] Entrepôts, zones, emplacements
- [ ] Stock par emplacement
- [ ] Alertes onglet **Stock catalogue** (seuils)

---

## 4. RFID (module 1)

- [ ] Tags : liste, association article
- [ ] Portiques / douchettes : config + scan test (`/api/portique/scan` ou handheld)
- [ ] Typologie / stats tags

---

## 5. Commandes (module 2)

- [ ] Créer / modifier commande événement
- [ ] Statuts cycle de vie (brouillon → en cours → …)
- [ ] Allocations matériel
- [ ] BS-EVT / chargement / retour si prévus sur la commande

---

## 6. Mouvements BE / BS / BT (module 3)

- [ ] Créer bon BE, scan lignes, signature
- [ ] Créer bon BS, signature
- [ ] Bon BT inter-sites si applicable
- [ ] PDF bon si disponible
- [ ] Annulation / rectification selon droits

---

## 7. Traçabilité (module 4)

- [ ] Chaîne de responsabilité sur un événement
- [ ] Historique utilisateur / actif
- [ ] Imputation / détenteur cohérent après mouvement signé

---

## 8. RH (module 5)

- [ ] Effectifs, affectations
- [ ] Véhicules
- [ ] Intérimaires (liste + export si utilisé)

---

## 9. Validation & alertes (modules 6–7)

- [ ] Matrice validation : action sensible bloquée sans droit
- [ ] Notifications métier : liste, marquer lu
- [ ] (Optionnel) Cron `POST /api/cdc/alerts/run` avec `CDC_CRON_SECRET`

---

## 10. Mobile terrain (Expo)

- [ ] `mobile/.env.local` : `EXPO_PUBLIC_API_BASE_URL=http://<IP-LAN>:3000`
- [ ] `npm run dev:mobile` — Metro + QR Expo Go
- [ ] Login terrain (JWT)
- [ ] Missions / bons visibles
- [ ] Scan RFID (ou saisie tag test)
- [ ] Signature bon
- [ ] Mode hors ligne : action en file → reconnexion → sync OK

---

## 11. API séparée (si `dev:backend`)

- [ ] `http://localhost:3001/api/health` → `stockevent-backend`
- [ ] Front avec `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` charge les données

---

## Critères de succès

- Aucune erreur 5xx sur les parcours ci-dessus
- Bons signés reflétés en stock / traçabilité
- Mobile synchronise après reconnexion sans perte silencieuse de la file

**Date / version testée :** _______________  
**Testeur :** _______________
