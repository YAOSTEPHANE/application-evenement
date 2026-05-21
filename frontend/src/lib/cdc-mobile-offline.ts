/** Mobilité & mode hors ligne (référentiel CDC, hors dashboard). */
export const CDC_MOBILE_OFFLINE_REF = "mobilite-offline";

export const CDC_MOBILE_PLATFORMS = ["ios", "android"] as const;

/** Fonctions critiques disponibles hors ligne (app `mobile/`). */
export const CDC_OFFLINE_CRITICAL_ACTIONS = [
  {
    id: "create_document",
    label: "Création de bon",
    description: "BS-EVT terrain à partir des tags RFID et de la commande.",
  },
  {
    id: "create_bt",
    label: "Transfert inter-sites (BT)",
    description: "BT-SE entre deux entrepôts avec tags RFID scannés.",
  },
  {
    id: "scan",
    label: "Scan RFID",
    description: "Douchette ou scan sur bon ouvert.",
  },
  {
    id: "sign",
    label: "Signature électronique",
    description: "Signature selon la matrice de validation.",
  },
  {
    id: "event_loading",
    label: "Chargement commande",
    description: "Génère le BS-EVT depuis la commande (chef d'équipe).",
  },
  {
    id: "event_be_ret",
    label: "Retour commande",
    description: "Génère le BE-RET à la clôture terrain.",
  },
  {
    id: "incident",
    label: "Incident terrain",
    description: "Perte, casse ou autre — notification responsables.",
  },
  {
    id: "portique",
    label: "Passage portique",
    description: "Contrôle entrée/sortie site (file si hors ligne).",
  },
] as const;

export const CDC_OFFLINE_SYNC_PRINCIPLE =
  "Synchronisation automatique à la reconnexion, dans l'ordre d'enregistrement, sans suppression des actions en échec.";

export function getMobileOfflineSpec() {
  return {
    ref: CDC_MOBILE_OFFLINE_REF,
    platforms: [...CDC_MOBILE_PLATFORMS],
    principle: CDC_OFFLINE_SYNC_PRINCIPLE,
    criticalActions: CDC_OFFLINE_CRITICAL_ACTIONS.map((a) => ({ ...a })),
    packagePath: "mobile/",
  };
}
