import type { PortalInstallationSite, PortalPassageDirection } from "@prisma/client";

/** CDC §5.3 — matériel de lecture RFID */

export type RfidScanAlertLevel = "ok" | "warning" | "error";

export type RfidScanAlert = {
  level: RfidScanAlertLevel;
  /** Alerte sonore (écart / passage bloqué) */
  sound: boolean;
  /** Alerte visuelle (bandeau, flash UI) */
  visual: boolean;
  title: string;
  detail: string;
};

export const PORTAL_INSTALLATION_LABELS: Record<PortalInstallationSite, string> = {
  WAREHOUSE_GATE: "Entrée / sortie d'entrepôt",
  LOADING_DOCK: "Quai de chargement",
};

export const PORTAL_CDC_CAPABILITIES = {
  automaticPassageLog: true,
  humanInterventionRequired: false,
  realtimeDocumentMatch: ["BS", "BE", "BT"] as const,
  discrepancyAlerts: { sound: true, visual: true },
} as const;

export const HANDHELD_CDC_CAPABILITIES = {
  useCases: [
    "Inventaires en rayons",
    "Contrôle dans les caisses sans déchargement",
    "Contrôles sur site (événement)",
  ],
  wirelessSync: true,
  immediateSync: true,
  minBatteryAutonomyHours: 24,
} as const;

export const PORTAL_EQUIPMENT_DOC = {
  title: "Lecteurs fixes (portiques)",
  section: "5.3.1",
  bullets: [
    "Installés aux entrées et sorties d'entrepôts ainsi qu'aux quais de chargement",
    "Enregistrement automatique de tous les passages, sans intervention humaine",
    "Rapprochement automatique avec le bon associé (BS, BE, BT) en temps réel",
    "Alerte sonore et visuelle en cas d'écart détecté",
  ],
} as const;

export const HANDHELD_EQUIPMENT_DOC = {
  title: "Lecteurs portatifs (douchettes)",
  section: "5.3.2",
  bullets: [
    "Inventaires en rayons, contrôle en caisses sans déchargement, contrôles sur site",
    "Connexion sans fil à la plateforme avec synchronisation immédiate",
    "Autonomie minimale d'une journée de travail (24 h)",
  ],
} as const;

export function passageLabelForDirection(direction: PortalPassageDirection): string {
  switch (direction) {
    case "ENTRY":
      return "Entrée — rapprochement BE";
    case "EXIT":
      return "Sortie — rapprochement BS";
    default:
      return "Entrée et sortie — BS, BE ou BT";
  }
}

export function documentsSoughtForPortal(
  direction: PortalPassageDirection,
  installationSite: PortalInstallationSite,
): string {
  if (installationSite === "LOADING_DOCK") {
    return "BT (transfert), BS ou BE ouvert";
  }
  return passageLabelForDirection(direction);
}
