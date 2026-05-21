import type { BeSubtype, BsSubtype, BtSubtype } from "@prisma/client";

import { BE_SUBTYPE_LABELS, BS_SUBTYPE_LABELS, BT_SUBTYPE_LABELS } from "@/lib/cdc-labels";

export type WizardField =
  | "event"
  | "fromWarehouse"
  | "toWarehouse"
  | "item"
  | "tag"
  | "qty"
  | "notes"
  | "photo";

export type WizardStep = {
  id: string;
  title: string;
  description: string;
  fields: WizardField[];
};

export type DocumentWizardConfig = {
  kind: "BE" | "BS" | "BT";
  subtype: string;
  label: string;
  steps: WizardStep[];
  requiresEvent: boolean;
  requiresFromWarehouse: boolean;
  requiresToWarehouse: boolean;
};

function cfg(
  kind: "BE" | "BS" | "BT",
  subtype: string,
  label: string,
  steps: WizardStep[],
  opts?: Partial<Pick<DocumentWizardConfig, "requiresEvent" | "requiresFromWarehouse" | "requiresToWarehouse">>,
): DocumentWizardConfig {
  return {
    kind,
    subtype,
    label,
    steps,
    requiresEvent: opts?.requiresEvent ?? false,
    requiresFromWarehouse: opts?.requiresFromWarehouse ?? kind !== "BE",
    requiresToWarehouse: opts?.requiresToWarehouse ?? kind !== "BS",
  };
}

const baseLines: WizardStep = {
  id: "lines",
  title: "Articles & tags RFID",
  description: "Sélectionnez le matériel et scannez les tags unitaires.",
  fields: ["item", "tag", "qty"],
};

const baseConfirm: WizardStep = {
  id: "confirm",
  title: "Validation",
  description: "Vérifiez le récapitulatif avant création du bon.",
  fields: ["notes"],
};

export const CDC_WIZARD_CONFIGS: DocumentWizardConfig[] = [
  cfg("BE", "BE_FRN", BE_SUBTYPE_LABELS.BE_FRN, [
    {
      id: "init",
      title: "Initialisation",
      description: "Sous-type BE-FRN, site de destination, référence BL fournisseur.",
      fields: ["toWarehouse", "notes"],
    },
    {
      id: "scan",
      title: "Scan RFID",
      description: "Lecture des tags — rapprochement attendu / reçu.",
      fields: ["item", "tag", "qty"],
    },
    {
      id: "quality",
      title: "Contrôle qualité",
      description: "État de chaque article, photos si endommagé.",
      fields: ["photo", "notes"],
    },
    {
      id: "sign",
      title: "Validation",
      description: "Signatures livreur et réceptionnaire (gestionnaire stock).",
      fields: ["notes"],
    },
  ], { requiresToWarehouse: true }),
  cfg("BE", "BE_RET", BE_SUBTYPE_LABELS.BE_RET, [
    {
      id: "init",
      title: "Initialisation",
      description: "Commande événement et entrepôt de réintégration.",
      fields: ["event", "toWarehouse"],
    },
    {
      id: "scan",
      title: "Scan RFID",
      description: "Tags lus au retour — réintégration totale requise pour solder la commande.",
      fields: ["item", "tag", "qty"],
    },
    {
      id: "quality",
      title: "Contrôle qualité",
      description: "État du matériel retourné.",
      fields: ["photo", "notes"],
    },
    {
      id: "sign",
      title: "Validation",
      description: "Stock + chef d'équipe.",
      fields: ["notes"],
    },
  ], { requiresEvent: true, requiresToWarehouse: true }),
  cfg("BE", "BE_TRF", BE_SUBTYPE_LABELS.BE_TRF, [
    {
      id: "init",
      title: "Initialisation",
      description: "Référence BT source, entrepôt destinataire.",
      fields: ["fromWarehouse", "toWarehouse", "notes"],
    },
    {
      id: "scan",
      title: "Scan RFID",
      description: "Réception inter-sites documentée.",
      fields: ["item", "tag", "qty"],
    },
    {
      id: "quality",
      title: "Contrôle qualité",
      fields: ["photo", "notes"],
      description: "Contrôle à l'arrivée.",
    },
    {
      id: "sign",
      title: "Validation",
      description: "Gestionnaire stock destinataire.",
      fields: ["notes"],
    },
  ], { requiresFromWarehouse: true, requiresToWarehouse: true }),
  cfg("BE", "BE_REP", BE_SUBTYPE_LABELS.BE_REP, [
    {
      id: "init",
      title: "Initialisation",
      description: "Réintégration après réparation.",
      fields: ["toWarehouse"],
    },
    {
      id: "scan",
      title: "Scan RFID",
      fields: ["item", "tag", "qty"],
      description: "Scan des unités remises en stock.",
    },
    {
      id: "quality",
      title: "Contrôle qualité",
      description: "Validation resp. technique.",
      fields: ["photo", "notes"],
    },
    {
      id: "sign",
      title: "Validation",
      fields: ["notes"],
      description: "Resp. technique + magasinier.",
    },
  ], { requiresToWarehouse: true }),
  cfg("BS", "BS_EVT", BS_SUBTYPE_LABELS.BS_EVT, [
    {
      id: "event-out",
      title: "Sortie événement",
      description:
        "Chargement commande — portique sortie (rapprochement tags), puis triple signature : stock, chauffeur, chef d'équipe.",
      fields: ["event", "fromWarehouse"],
    },
    baseLines,
    baseConfirm,
  ], { requiresEvent: true, requiresFromWarehouse: true }),
  cfg("BS", "BS_LOC", BS_SUBTYPE_LABELS.BS_LOC, [
    {
      id: "subrent",
      title: "Sous-location",
      description: "Sortie temporaire vers client / partenaire.",
      fields: ["fromWarehouse", "notes"],
    },
    baseLines,
    baseConfirm,
  ], { requiresFromWarehouse: true }),
  cfg("BS", "BS_REP", BS_SUBTYPE_LABELS.BS_REP, [
    {
      id: "repair-out",
      title: "Réparation externe",
      description: "Envoi atelier — photos recommandées.",
      fields: ["fromWarehouse", "photo"],
    },
    baseLines,
    baseConfirm,
  ], { requiresFromWarehouse: true }),
  cfg("BS", "BS_RBT", BS_SUBTYPE_LABELS.BS_RBT, [
    {
      id: "scrap",
      title: "Mise au rebut",
      description: "Sortie définitive — quarantaine préalable si litige.",
      fields: ["fromWarehouse", "photo", "notes"],
    },
    baseLines,
    baseConfirm,
  ], { requiresFromWarehouse: true }),
  cfg("BT", "BT_EE", BT_SUBTYPE_LABELS.BT_EE, [
    {
      id: "wh-wh",
      title: "Entrepôt → entrepôt",
      description: "Rééquilibrage — gestionnaires stock des deux sites (émission puis réception).",
      fields: ["fromWarehouse", "toWarehouse"],
    },
    baseLines,
    baseConfirm,
  ], { requiresFromWarehouse: true, requiresToWarehouse: true }),
  cfg("BT", "BT_ES", BT_SUBTYPE_LABELS.BT_ES, [
    {
      id: "wh-site",
      title: "Entrepôt → site",
      description: "Renfort en cours — gestionnaire stock (émission) puis chef d'équipe (réception).",
      fields: ["event", "fromWarehouse", "toWarehouse"],
    },
    baseLines,
    baseConfirm,
  ], { requiresEvent: true, requiresFromWarehouse: true, requiresToWarehouse: true }),
  cfg("BT", "BT_SS", BT_SUBTYPE_LABELS.BT_SS, [
    {
      id: "site-site",
      title: "Site → site",
      description: "Mutualisation — chefs d'équipe / resp. technique (émission et réception).",
      fields: ["event", "fromWarehouse", "toWarehouse"],
    },
    baseLines,
    baseConfirm,
  ], { requiresEvent: true, requiresFromWarehouse: true, requiresToWarehouse: true }),
  cfg("BT", "BT_SE", BT_SUBTYPE_LABELS.BT_SE, [
    {
      id: "site-wh",
      title: "Site → entrepôt",
      description: "Rapatriement anticipé — chef d'équipe (émission) puis gestionnaire stock (réception).",
      fields: ["event", "fromWarehouse", "toWarehouse"],
    },
    baseLines,
    baseConfirm,
  ], { requiresEvent: true, requiresFromWarehouse: true, requiresToWarehouse: true }),
];

export function getWizardConfig(
  kind: "BE" | "BS" | "BT",
  subtype: string,
): DocumentWizardConfig | undefined {
  return CDC_WIZARD_CONFIGS.find((c) => c.kind === kind && c.subtype === subtype);
}

export function listWizardPresets(): Array<{ kind: "BE" | "BS" | "BT"; subtype: string; label: string }> {
  return CDC_WIZARD_CONFIGS.map((c) => ({ kind: c.kind, subtype: c.subtype, label: c.label }));
}
