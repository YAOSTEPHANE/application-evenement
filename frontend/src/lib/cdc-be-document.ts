import { BeSubtype, StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";

export const CDC_BE_SECTION = "7.2";

export const CDC_BE_TITLE = "Bon d'Entrée (BE)";

export const CDC_BE_SUMMARY =
  "Le Bon d'Entrée matérialise tout flux entrant de matériel dans un site de stockage. Il est généré exclusivement via l'application.";

export const CDC_BE_NUMBER_FORMAT = "BE-AAAA-NNNN";

export type BeSubtypeDefinition = {
  code: BeSubtype;
  label: string;
  description: string;
  /** Émetteur CDC §7.2.1 */
  emitter: string;
};

export const CDC_BE_SUBTYPES: readonly BeSubtypeDefinition[] = [
  {
    code: "BE_FRN",
    label: "BE-FRN",
    description: "Réception fournisseur (achat de matériel neuf ou loué)",
    emitter: "Gestionnaire de stock",
  },
  {
    code: "BE_RET",
    label: "BE-RET",
    description: "Retour de matériel après prestation événementielle",
    emitter: "Gestionnaire stock + Chef d'équipe",
  },
  {
    code: "BE_TRF",
    label: "BE-TRF",
    description: "Réception suite à un transfert inter-sites",
    emitter: "Gestionnaire stock destinataire",
  },
  {
    code: "BE_REP",
    label: "BE-REP",
    description: "Réintégration après réparation ou remise en état",
    emitter: "Responsable technique",
  },
] as const;

export const CDC_BE_MANDATORY_FIELDS: readonly string[] = [
  "Numéro unique automatique (BE-AAAA-NNNN)",
  "Date et heure de l'opération (horodatage automatique)",
  "Site de destination",
  "Liste matériel : tag RFID, désignation, quantité attendue / reçue, état",
  "Identité du livreur et du réceptionnaire",
  "Référence commande, bon de transfert ou BL fournisseur",
  "Photos si matériel endommagé",
  "Observations et anomalies",
  "Signatures électroniques des parties",
];

export type BeProcessingStep = {
  order: number;
  id: string;
  title: string;
  description: string;
};

export const CDC_BE_PROCESSING_STEPS: readonly BeProcessingStep[] = [
  {
    order: 1,
    id: "init",
    title: "Initialisation",
    description: "Création du BE et sélection du sous-type.",
  },
  {
    order: 2,
    id: "scan",
    title: "Scan RFID",
    description:
      "Lecture des tags (douchette ou portique), rapprochement automatique attendu / reçu.",
  },
  {
    order: 3,
    id: "quality",
    title: "Contrôle qualité",
    description: "Qualification de l'état de chaque article.",
  },
  {
    order: 4,
    id: "sign",
    title: "Validation",
    description: "Signatures électroniques du livreur et du réceptionnaire.",
  },
  {
    order: 5,
    id: "stock",
    title: "Mise à jour stock",
    description: "Stock actualisé et notifications métier déclenchées.",
  },
] as const;

export function getBeSubtypeDefinition(subtype: BeSubtype): BeSubtypeDefinition {
  return CDC_BE_SUBTYPES.find((s) => s.code === subtype) ?? CDC_BE_SUBTYPES[0];
}

export type BeDocumentProgressInput = {
  status: StockDocumentStatus;
  beSubtype: BeSubtype | null;
  eventId?: string | null;
  toWarehouseId: string | null;
  shipperUserId: string | null;
  receiverUserId: string | null;
  sourceReference: string | null;
  lines: Array<{
    expectedQty: number;
    scannedQty: number;
    receivedQty: number;
    lineCondition: string | null;
  }>;
  signatureCount: number;
  signaturesRequired: number;
};

export function resolveBeProcessingStepIndex(input: BeDocumentProgressInput): number {
  if (input.status === StockDocumentStatus.SIGNED) return 5;
  if (input.status === StockDocumentStatus.CANCELLED) return 0;
  if (!input.toWarehouseId || !input.beSubtype) return 1;
  const rfidOk = documentLinesRfidComplete(input.lines);
  const qualityOk = input.lines.every((l) => l.lineCondition);
  if (
    input.status === StockDocumentStatus.PENDING_SIGNATURE &&
    input.signatureCount >= input.signaturesRequired &&
    rfidOk &&
    qualityOk
  ) {
    return 4;
  }
  if (rfidOk && qualityOk) return 4;
  if (rfidOk || input.status === StockDocumentStatus.SCANNING) return 3;
  if (input.lines.some((l) => l.scannedQty > 0)) return 2;
  return 1;
}

export type BeSignatureCheck = { ok: true } | { ok: false; message: string };

/** Contrôles CDC §7.2.2 avant clôture par signatures complètes. */
export function assertBeMandatoryFieldsForSignature(
  doc: BeDocumentProgressInput & { kind: StockDocumentKind },
): BeSignatureCheck {
  if (doc.kind !== StockDocumentKind.BE) return { ok: true };
  if (!doc.beSubtype) {
    return { ok: false, message: "Sous-type BE obligatoire." };
  }
  if (!doc.toWarehouseId) {
    return { ok: false, message: "Site de destination requis sur le BE." };
  }
  if (doc.lines.length === 0) {
    return { ok: false, message: "Liste matériel vide — ajoutez au moins une ligne." };
  }
  if (!documentLinesRfidComplete(doc.lines)) {
    return {
      ok: false,
      message: "Scan RFID incomplet — chaque ligne doit atteindre la quantité attendue.",
    };
  }
  if (!doc.shipperUserId || !doc.receiverUserId) {
    return {
      ok: false,
      message: "Identité du livreur et du réceptionnaire obligatoires avant signature.",
    };
  }
  if (doc.beSubtype === BeSubtype.BE_FRN && !doc.sourceReference?.trim()) {
    return {
      ok: false,
      message: "Référence BL / fournisseur obligatoire pour un BE-FRN.",
    };
  }
  if (doc.beSubtype === BeSubtype.BE_TRF && !doc.sourceReference?.trim()) {
    return {
      ok: false,
      message: "Référence du bon de transfert source obligatoire pour un BE-TRF.",
    };
  }
  if (doc.beSubtype === BeSubtype.BE_RET && !doc.eventId) {
    return { ok: false, message: "Commande événement liée obligatoire pour un BE-RET." };
  }
  return { ok: true };
}
