import { BtSubtype, StockDocumentKind, StockDocumentStatus, type Role } from "@prisma/client";

export type BtSignSlot = { role: Role; label: string };

export const BT_TRANSFER_DISPUTE_HOURS = 48;

export type BtLineQty = {
  expectedQty: number;
  scannedQty: number;
  receivedQty: number;
};

export function btAllSignSlots(btSubtype: BtSubtype | null | undefined): BtSignSlot[] {
  switch (btSubtype) {
    case BtSubtype.BT_EE:
      return [
        { role: "STOREKEEPER", label: "Gestionnaire stock — émission site source" },
        { role: "STOREKEEPER", label: "Gestionnaire stock — réception site destinataire" },
      ];
    case BtSubtype.BT_ES:
      return [
        { role: "STOREKEEPER", label: "Gestionnaire stock — émission entrepôt" },
        { role: "TECHNICAL_MANAGER", label: "Chef d'équipe — réception site événementiel" },
      ];
    case BtSubtype.BT_SS:
      return [
        { role: "TECHNICAL_MANAGER", label: "Chef d'équipe — émission site source" },
        {
          role: "TECHNICAL_MANAGER",
          label: "Resp. technique / chef équipe — réception site destinataire",
        },
      ];
    case BtSubtype.BT_SE:
      return [
        { role: "TECHNICAL_MANAGER", label: "Chef d'équipe — émission site" },
        { role: "STOREKEEPER", label: "Gestionnaire stock — réception entrepôt" },
      ];
    default:
      return [
        { role: "STOREKEEPER", label: "Émission transfert" },
        { role: "STOREKEEPER", label: "Réception transfert" },
      ];
  }
}

export function btEmissionScanComplete(lines: BtLineQty[]): boolean {
  return lines.length > 0 && lines.every((l) => l.scannedQty >= l.expectedQty);
}

export function btReceptionScanComplete(lines: BtLineQty[]): boolean {
  return lines.length > 0 && lines.every((l) => l.receivedQty >= 0 && l.scannedQty > 0);
}

export function btTransferQuantityDiscrepancy(lines: BtLineQty[]): boolean {
  return lines.some((l) => l.receivedQty !== l.scannedQty);
}

export function btDisputeDeadlineFrom(openedAt: Date = new Date()): Date {
  const d = new Date(openedAt);
  d.setHours(d.getHours() + BT_TRANSFER_DISPUTE_HOURS);
  return d;
}

export type BtDocumentProgressInput = {
  status: StockDocumentStatus;
  btSubtype: BtSubtype | null;
  btReceptionScannedAt?: Date | null;
  eventId?: string | null;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  lines: BtLineQty[];
  signatureCount: number;
  signaturesRequired: number;
};

export function btRequiresEvent(btSubtype: BtSubtype | null | undefined): boolean {
  return btSubtype === BtSubtype.BT_ES || btSubtype === BtSubtype.BT_SS || btSubtype === BtSubtype.BT_SE;
}

export function assertBtMandatoryFieldsForSignature(
  doc: BtDocumentProgressInput & { kind: StockDocumentKind },
): { ok: true } | { ok: false; message: string } {
  if (doc.kind !== StockDocumentKind.BT) return { ok: true };
  if (!doc.btSubtype || !doc.fromWarehouseId || !doc.toWarehouseId) {
    return { ok: false, message: "BT incomplet." };
  }
  if (doc.signatureCount < 1) {
    if (!btEmissionScanComplete(doc.lines)) {
      return { ok: false, message: "Phase émission : scan départ incomplet." };
    }
  } else {
    if (!doc.btReceptionScannedAt) {
      return { ok: false, message: "Phase réception : scan arrivée requis." };
    }
  }
  if (btRequiresEvent(doc.btSubtype) && !doc.eventId) {
    return { ok: false, message: "Événement obligatoire pour ce BT." };
  }
  return { ok: true };
}

export const CDC_BT_SUBTYPES = [
  { code: "BT_EE" as const, label: "BT-EE" },
  { code: "BT_ES" as const, label: "BT-ES" },
  { code: "BT_SS" as const, label: "BT-SS" },
  { code: "BT_SE" as const, label: "BT-SE" },
];

export function getBtPublicSpec() {
  return { section: "7.4", title: "Bon de Transfert (BT)", subtypes: CDC_BT_SUBTYPES };
}
