import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "EVENT·RFID Terrain",
  slug: "event-rfid-terrain",
  version: "0.1.0",
  /** App terrain native uniquement — pas de build web (évite l’erreur au raccourci `w`). */
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "eventrfid",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#060e1a",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.eventrfid.terrain",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#060e1a",
    },
    package: "com.eventrfid.terrain",
    // HTTP LAN (API locale) — propriété manifest Android, hors types ExpoConfig stricts
    usesCleartextTraffic: true,
  } as ExpoConfig["android"] & { usesCleartextTraffic?: boolean },
  plugins: [["expo-router", { root: "./app" }], "expo-font"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
  },
};

export default config;
