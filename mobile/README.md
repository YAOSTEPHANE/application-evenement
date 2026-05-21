# EVENT·RFID — App mobile terrain (React Native)

Application **React Native** (Expo) pour téléphones physiques **iOS et Android** : création de bons BS-EVT, scan RFID, signatures, missions et incidents terrain.

## Mode hors ligne (fonctions critiques)

Sans réseau, l’app conserve en local (AsyncStorage) :

- **Création de bon** BS-EVT (tags + commande) → file `create_document`
- **Scan** douchette ou sur bon → file `scan` / `portique`
- **Signature** → file `sign`
- **Chargement / retour commande** → files `event_loading`, `event_be_ret` (BS-EVT / BE-RET auto)
- **Incident terrain** → file `incident`

À la **reconnexion**, la file est rejouée **dans l’ordre** ; les actions en échec restent en attente (aucune suppression silencieuse). Les bons créés hors ligne reçoivent un identifiant temporaire (`temp_…`) remplacé par l’ID serveur après sync.

Cache local des bons ouverts, missions et lecteurs pour continuer à travailler sans API.

> Ce n’est **pas** une PWA web : le dossier `mobile/` est une app native via [Expo](https://expo.dev).

## Prérequis

- Node.js 20+
- [Expo Go](https://expo.dev/go) sur le téléphone **ou** émulateur Android / simulateur iOS
- Le back-office API doit tourner (`frontend` sur le port **3000** en local)

## Configuration

Copier `.env.example` vers `.env.local` :

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000
```

Sur téléphone physique : utiliser l’**IP LAN du PC**, pas `localhost`.

## Expo SDK 54

Compatible avec **Expo Go** actuel (Play Store / App Store). Ne pas lancer `npm audit fix` dans `mobile/`.

Réaligner les versions si besoin : `cd mobile && npx expo install --fix`

**Important :** scanner le QR code sur le terminal — ne pas appuyer sur `w` (mode Web, non supporté pour cette app).

## Lancer l’app

À la racine du monorepo :

```bash
npm install
cd mobile && npm install
npm run dev:frontend
```

Autre terminal :

```bash
npm run dev:mobile
```

(`mobile/` n’est plus un workspace npm : ses dépendances s’installent dans `mobile/node_modules`.)

Les scripts `dev` / `start` utilisent `scripts/expo-dev.mjs` (pas `expo start` directement).

Puis scanner le QR code avec **Expo Go**, ou :

- `cd mobile && npm run android`
- `cd mobile && npm run ios` (macOS)

### Erreur `Body has already been read` au démarrage

Bug connu d’Expo CLI avec **Node 22+** : cache `native-modules-cache` + double lecture du body HTTP.

`scripts/expo-dev.mjs` applique automatiquement :

- suppression du cache `~/.expo/native-modules-cache` au démarrage ;
- `EXPO_NO_DEPENDENCY_VALIDATION=1` ;
- `EXPO_OFFLINE=1` (pas d’appel `api.expo.dev` pour les versions natives).

Pour réactiver les checks réseau Expo (alignement versions) :

```powershell
cd mobile
$env:EXPO_OFFLINE = "0"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "0"
npm run dev:expo-raw
```

Puis si besoin : `npx expo install --fix`

## Authentification native

L’API renvoie un `sessionToken` (JWT) utilisé en en-tête `Authorization: Bearer …` — adapté aux clients React Native (pas de cookies navigateur).

## Build production

```bash
cd mobile
npx expo prebuild
npx expo run:android
# ou npx expo run:ios
```

Les routes API terrain restent dans `frontend/src/app/api/terrain/*` (serveur métier).
