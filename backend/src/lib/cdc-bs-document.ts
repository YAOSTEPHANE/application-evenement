import { BsSubtype, StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";

export const CDC_BS_SUBTYPES = [
  { code: "BS_EVT" as const, label: "BS-EVT", principalValidator: "Gestionnaire de stock" },
  { code: "BS_LOC" as const, label: "BS-LOC", principalValidator: "Administrateur" },
  { code: "BS_REP" as const, label: "BS-REP", principalValidator: "Responsable technique" },
  { code: "BS_RBT" as const, label: "BS-RBT", principalValidator: "Administrateur" },
];

export function getBsPublicSpec() {
  return {
    section: "7.3",
    title: "Bon de Sortie (BS)",
    subtypes: CDC_BS_SUBTYPES,
  };
}

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

export function assertBsMandatoryFieldsForSignature(
  doc: BsDocumentProgressInput & { kind: StockDocumentKind },
): { ok: true } | { ok: false; message: string } {
  if (doc.kind !== StockDocumentKind.BS) return { ok: true };
  if (!doc.bsSubtype || !doc.fromWarehouseId) {
    return { ok: false, message: "BS incomplet." };
  }
  if (!documentLinesRfidComplete(doc.lines)) {
    return { ok: false, message: "Scan RFID incomplet." };
  }
  if (doc.bsSubtype === BsSubtype.BS_EVT) {
    if (!doc.eventId || !doc.driverUserId) {
      return { ok: false, message: "BS-EVT : commande et chauffeur obligatoires." };
    }
  }
  return { ok: true };
}
