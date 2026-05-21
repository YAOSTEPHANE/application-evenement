import { BsSubtype, StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";

export const CDC_BS_SECTION = "7.3";

export const CDC_BS_TITLE = "Bon de Sortie (BS)";

export const CDC_BS_SUMMARY =
  "Le Bon de Sortie matérialise tout flux sortant de matériel d'un site de stockage à destination d'un site événementiel ou d'un prestataire externe. Généré exclusivement via l'application.";

export const CDC_BS_NUMBER_FORMAT = "BS-AAAA-NNNN";

export type BsSubtypeDefinition = {
  code: BsSubtype;
  label: string;
  description: string;
  /** Validateur principal CDC §7.3.1 */
  principalValidator: string;
};

export const CDC_BS_SUBTYPES: readonly BsSubtypeDefinition[] = [
  {
    code: "BS_EVT",
    label: "BS-EVT",
    description: "Sortie pour prestation événementielle",
    principalValidator: "Gestionnaire de stock",
  },
  {
    code: "BS_LOC",
    label: "BS-LOC",
    description: "Sortie pour sous-location à un tiers",
    principalValidator: "Administrateur",
  },
  {
    code: "BS_REP",
    label: "BS-REP",
    description: "Sortie pour réparation externe",
    principalValidator: "Responsable technique",
  },
  {
    code: "BS_RBT",
    label: "BS-RBT",
    description: "Sortie pour rebut / mise au rebut définitive",
    principalValidator: "Administrateur",
  },
] as const;

/** CDC §7.3.2 — triple signature BS-EVT */
export const CDC_BS_EVT_TRIPLE_SIGNATURES: readonly {
  order: number;
  roleKey: string;
  label: string;
}[] = [
  { order: 1, roleKey: "STOREKEEPER", label: "Gestionnaire de stock — validation sortie physique" },
  { order: 2, roleKey: "FLEET_MANAGER", label: "Chauffeur — responsabilité pendant le transport" },
  {
    order: 3,
    roleKey: "TECHNICAL_MANAGER",
    label: "Chef d'équipe destinataire — réception sur site",
  },
] as const;

export const CDC_BS_PORTIQUE_CONTROL =
  "Passage au portique RFID en sortie : rapprochement automatique tags véhicule / liste théorique du BS. Tout écart bloque la sortie et génère une alerte.";

export type BsDocumentProgressInput = {
  status: StockDocumentStatus;
  bsSubtype: BsSubtype | null;
  eventId?: string | null;
  fromWarehouseId: string | null;
  driverUserId: string | null;
  lines: Array<{ expectedQty: number; scannedQty: number }>;
  signatureCount: number;
  signaturesRequired: number;
};

export function getBsSubtypeDefinition(subtype: BsSubtype): BsSubtypeDefinition {
  return CDC_BS_SUBTYPES.find((s) => s.code === subtype) ?? CDC_BS_SUBTYPES[0];
}

export function requiresTripleSignature(bsSubtype: BsSubtype | null | undefined): boolean {
  return bsSubtype === BsSubtype.BS_EVT;
}

export type BsSignatureCheck = { ok: true } | { ok: false; message: string };

export function assertBsMandatoryFieldsForSignature(
  doc: BsDocumentProgressInput & { kind: StockDocumentKind },
): BsSignatureCheck {
  if (doc.kind !== StockDocumentKind.BS) return { ok: true };
  if (!doc.bsSubtype) {
    return { ok: false, message: "Sous-type BS obligatoire." };
  }
  if (!doc.fromWarehouseId) {
    return { ok: false, message: "Site source (entrepôt) requis sur le BS." };
  }
  if (doc.lines.length === 0) {
    return { ok: false, message: "Liste matériel vide." };
  }
  if (!documentLinesRfidComplete(doc.lines)) {
    return {
      ok: false,
      message: "Scan RFID incomplet — rapprochement attendu/scanné requis avant signature finale.",
    };
  }

  if (doc.bsSubtype === BsSubtype.BS_EVT) {
    if (!doc.eventId) {
      return { ok: false, message: "Commande événement obligatoire pour un BS-EVT." };
    }
    if (!doc.driverUserId) {
      return {
        ok: false,
        message: "Chauffeur identifié obligatoire avant clôture du BS-EVT (triple signature).",
      };
    }
    if (doc.signaturesRequired < 3) {
      return { ok: false, message: "BS-EVT : triple signature requise." };
    }
  }

  return { ok: true };
}

export function getBsPublicSpec() {
  return {
    section: CDC_BS_SECTION,
    title: CDC_BS_TITLE,
    summary: CDC_BS_SUMMARY,
    numberFormat: CDC_BS_NUMBER_FORMAT,
    subtypes: CDC_BS_SUBTYPES,
    tripleSignatures: CDC_BS_EVT_TRIPLE_SIGNATURES,
    portiqueControl: CDC_BS_PORTIQUE_CONTROL,
  };
}
