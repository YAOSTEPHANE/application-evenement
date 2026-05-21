import type { RfidTagType } from "@prisma/client";

/** CDC §5.2 — cinq supports RFID selon le type de matériel. */
export type RfidTagTypologyEntry = {
  type: RfidTagType;
  /** Libellé court (listes, badges) */
  label: string;
  /** Intitulé technique */
  title: string;
  /** Matériels concernés */
  materials: string;
  /** Contraintes / pose */
  particularities: string;
};

export const RFID_TAG_TYPOLOGY_ORDER: RfidTagType[] = [
  "ON_METAL",
  "NAILED_WOOD",
  "TEXTILE",
  "ADHESIVE",
  "BOX_STANDARD",
];

export const RFID_TAG_TYPOLOGY: RfidTagTypologyEntry[] = [
  {
    type: "ON_METAL",
    label: "On-Metal",
    title: "On-Metal",
    materials: "Poteaux fer, structures métalliques",
    particularities:
      "Conçus pour ne pas subir d'interférences avec le métal, robustes aux chocs",
  },
  {
    type: "NAILED_WOOD",
    label: "À clouer / encastrable",
    title: "À clouer / encastrable",
    materials: "Planchers en bois, planches",
    particularities: "Fixation durable dans le bois, résistants au piétinement",
  },
  {
    type: "TEXTILE",
    label: "Textile souple",
    title: "Textile souple",
    materials: "Tapis, velums, revêtements",
    particularities: "Cousus ou collés, supportent le nettoyage et la flexion",
  },
  {
    type: "ADHESIVE",
    label: "Adhésif discret",
    title: "Adhésif discret",
    materials: "Mobilier (chaises, tables)",
    particularities: "Pose rapide, protection esthétique, peu visible",
  },
  {
    type: "BOX_STANDARD",
    label: "Standard haute performance",
    title: "Standard haute performance",
    materials: "Petit matériel en caisses",
    particularities:
      "Lecture groupée à travers les parois des caisses, sans déchargement",
  },
];

const BY_TYPE = new Map(RFID_TAG_TYPOLOGY.map((e) => [e.type, e]));

export function getRfidTagTypology(type: RfidTagType): RfidTagTypologyEntry {
  const entry = BY_TYPE.get(type);
  if (!entry) {
    throw new Error(`Type de tag inconnu : ${type}`);
  }
  return entry;
}

export function rfidTagTypologyLabels(): Record<RfidTagType, string> {
  return Object.fromEntries(RFID_TAG_TYPOLOGY.map((e) => [e.type, e.label])) as Record<
    RfidTagType,
    string
  >;
}

/** Suggestion selon le nom de catégorie / article (aide à la saisie). */
export function suggestRfidTagTypeFromMaterialHint(hint: string): RfidTagType {
  const h = hint.toLowerCase();
  if (/métal|metal|fer|structure|poteau|acier|charpente/.test(h)) {
    return "ON_METAL";
  }
  if (/bois|plancher|planche|parquet|sol/.test(h)) {
    return "NAILED_WOOD";
  }
  if (/tapis|velum|textile|tissu|revêtement|drap|nappe/.test(h)) {
    return "TEXTILE";
  }
  if (/caisse|box|accessoire|petit|consommable/.test(h)) {
    return "BOX_STANDARD";
  }
  if (/mobilier|chaise|table|fauteuil|buffet/.test(h)) {
    return "ADHESIVE";
  }
  return "ADHESIVE";
}

export function isRfidTagType(value: string): value is RfidTagType {
  return RFID_TAG_TYPOLOGY_ORDER.includes(value as RfidTagType);
}
