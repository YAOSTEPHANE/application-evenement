import { BeSubtype, StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";

export const CDC_BE_SUMMARY =
  "Bon d'Entrée — flux entrant documenté, généré uniquement via l'application (BE-AAAA-NNNN).";

export type BeDocumentProgressInput = {
  status: StockDocumentStatus;
  beSubtype: BeSubtype | null;
  eventId?: string | null;
  toWarehouseId: string | null;
  shipperUserId: string | null;
  receiverUserId: string | null;
  sourceReference: string | null;
  lines: Array<{ expectedQty: number; scannedQty: number; receivedQty: number; lineCondition: string | null }>;
  signatureCount: number;
  signaturesRequired: number;
};

export function assertBeMandatoryFieldsForSignature(
  doc: BeDocumentProgressInput & { kind: StockDocumentKind },
): { ok: true } | { ok: false; message: string } {
  if (doc.kind !== StockDocumentKind.BE) return { ok: true };
  if (!doc.beSubtype) return { ok: false, message: "Sous-type BE obligatoire." };
  if (!doc.toWarehouseId) return { ok: false, message: "Site de destination requis." };
  if (!documentLinesRfidComplete(doc.lines)) {
    return { ok: false, message: "Scan RFID incomplet." };
  }
  if (!doc.shipperUserId || !doc.receiverUserId) {
    return { ok: false, message: "Livreur et réceptionnaire obligatoires." };
  }
  if (doc.beSubtype === BeSubtype.BE_FRN && !doc.sourceReference?.trim()) {
    return { ok: false, message: "Référence BL fournisseur obligatoire (BE-FRN)." };
  }
  if (doc.beSubtype === BeSubtype.BE_TRF && !doc.sourceReference?.trim()) {
    return { ok: false, message: "Référence BT source obligatoire (BE-TRF)." };
  }
  if (doc.beSubtype === BeSubtype.BE_RET && !doc.eventId) {
    return { ok: false, message: "Commande événement liée obligatoire pour un BE-RET." };
  }
  return { ok: true };
}
