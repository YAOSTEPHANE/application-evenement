import { BtSubtype, StockDocumentKind, StockDocumentStatus, type Role } from "@prisma/client";


export type BtSignSlot = { role: Role; label: string };

export const CDC_BT_SECTION = "7.4";

export const CDC_BT_TITLE = "Bon de Transfert (BT)";

export const CDC_BT_SUMMARY =
  "Le Bon de Transfert matérialise tout déplacement de matériel entre deux sites de l'organisation, sans changement de propriété. Généré exclusivement via l'application.";

export const CDC_BT_NUMBER_FORMAT = "BT-AAAA-NNNN";

export const CDC_BT_TRANSIT_NOTE =
  "Double validation émission (site source) puis réception (site destinataire), délai de transit maximal 48 h.";

export const BT_TRANSFER_DISPUTE_HOURS = 48;

/** CDC §7.4.2 — processus à double validation */
export const CDC_BT_DOUBLE_VALIDATION_PHASES: readonly {
  id: string;
  title: string;
  description: string;
}[] = [
  {
    id: "emission",
    title: "Phase 1 — Émission",
    description:
      "Le site expéditeur génère le BT, scanne le départ et signe. Le matériel passe « En transit » ; la responsabilité reste chez l'expéditeur.",
  },
  {
    id: "reception",
    title: "Phase 2 — Réception",
    description:
      "Le site destinataire scanne les tags reçus, valide les quantités et signe l'arrivée. La responsabilité bascule sur le destinataire.",
  },
  {
    id: "reconciliation",
    title: "Phase 3 — Réconciliation",
    description:
      "Tout écart entre quantité expédiée et reçue ouvre un litige de transfert à trancher sous 48 h par l'administrateur.",
  },
] as const;

export type BtLineQty = {
  expectedQty: number;
  scannedQty: number;
  receivedQty: number;
};

/** Quantité expédiée = scannedQty figée à l'émission. */
export function btEmissionScanComplete(lines: BtLineQty[]): boolean {
  return lines.length > 0 && lines.every((l) => l.scannedQty >= l.expectedQty);
}

export function btReceptionScanComplete(lines: BtLineQty[]): boolean {
  return lines.length > 0 && lines.every((l) => l.receivedQty >= 0 && l.scannedQty > 0);
}

/** Écart expédié (scannedQty) vs reçu (receivedQty). */
export function btTransferQuantityDiscrepancy(lines: BtLineQty[]): boolean {
  return lines.some((l) => l.receivedQty !== l.scannedQty);
}

export function btDisputeDeadlineFrom(openedAt: Date = new Date()): Date {
  const d = new Date(openedAt);
  d.setHours(d.getHours() + BT_TRANSFER_DISPUTE_HOURS);
  return d;
}

export function btTransitPhaseLabel(
  phase: import("@prisma/client").BtTransitPhase | null | undefined,
  status: StockDocumentStatus,
): string {
  if (status === StockDocumentStatus.DISPUTED) return "Litige transfert";
  if (phase === "IN_TRANSIT") return "En transit — attente réception";
  if (phase === "ARRIVAL" || status === StockDocumentStatus.SIGNED) return "Réception validée";
  return "Émission / préparation";
}

export type BtSubtypeDefinition = {
  code: BtSubtype;
  label: string;
  useCase: string;
  /** Validation CDC §7.4.1 */
  validation: string;
};

export const CDC_BT_SUBTYPES: readonly BtSubtypeDefinition[] = [
  {
    code: "BT_EE",
    label: "BT-EE",
    useCase: "Entrepôt → entrepôt (rééquilibrage de stock)",
    validation: "Gestionnaires stock des deux sites",
  },
  {
    code: "BT_ES",
    label: "BT-ES",
    useCase: "Entrepôt → site événementiel (renfort en cours)",
    validation: "Gestionnaire stock + chef d'équipe",
  },
  {
    code: "BT_SS",
    label: "BT-SS",
    useCase: "Site → site (mutualisation événements simultanés)",
    validation: "Chefs d'équipe + responsable technique",
  },
  {
    code: "BT_SE",
    label: "BT-SE",
    useCase: "Site → entrepôt (rapatriement partiel anticipé)",
    validation: "Chef d'équipe + gestionnaire stock",
  },
] as const;

/** Plan complet des 2 signatures BT (émission puis réception). */
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

export type BtDocumentProgressInput = {
  status: StockDocumentStatus;
  btSubtype: BtSubtype | null;
  btTransitPhase?: import("@prisma/client").BtTransitPhase | null;
  btReceptionScannedAt?: Date | null;
  eventId?: string | null;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  lines: BtLineQty[];
  signatureCount: number;
  signaturesRequired: number;
};

export function getBtSubtypeDefinition(subtype: BtSubtype): BtSubtypeDefinition {
  return CDC_BT_SUBTYPES.find((s) => s.code === subtype) ?? CDC_BT_SUBTYPES[0];
}

export function btRequiresEvent(btSubtype: BtSubtype | null | undefined): boolean {
  return btSubtype === BtSubtype.BT_ES || btSubtype === BtSubtype.BT_SS || btSubtype === BtSubtype.BT_SE;
}

export type BtSignatureCheck = { ok: true } | { ok: false; message: string };

export function assertBtMandatoryFieldsForSignature(
  doc: BtDocumentProgressInput & { kind: StockDocumentKind },
): BtSignatureCheck {
  if (doc.kind !== StockDocumentKind.BT) return { ok: true };
  if (!doc.btSubtype) {
    return { ok: false, message: "Sous-type BT obligatoire." };
  }
  if (!doc.fromWarehouseId || !doc.toWarehouseId) {
    return { ok: false, message: "Sites source et destinataire requis sur le BT." };
  }
  if (doc.fromWarehouseId === doc.toWarehouseId) {
    return { ok: false, message: "Les sites source et destinataire doivent être distincts." };
  }
  if (doc.lines.length === 0) {
    return { ok: false, message: "Liste matériel vide." };
  }
  const emissionStep = doc.signatureCount < 1;
  if (emissionStep) {
    if (!btEmissionScanComplete(doc.lines)) {
      return {
        ok: false,
        message: "Phase émission : scan RFID départ incomplet (quantités expédiées).",
      };
    }
  } else {
    if (!doc.btReceptionScannedAt) {
      return {
        ok: false,
        message: "Phase réception : scan des tags à l'arrivée requis avant signature.",
      };
    }
    if (!btReceptionScanComplete(doc.lines)) {
      return {
        ok: false,
        message: "Phase réception : enregistrez le scan RFID du site destinataire.",
      };
    }
  }
  if (btRequiresEvent(doc.btSubtype) && !doc.eventId) {
    return { ok: false, message: "Commande / événement obligatoire pour ce sous-type BT." };
  }
  if (doc.signaturesRequired < 2) {
    return { ok: false, message: "BT : double validation émission / réception requise." };
  }
  return { ok: true };
}

export function getBtPublicSpec() {
  return {
    section: CDC_BT_SECTION,
    title: CDC_BT_TITLE,
    summary: CDC_BT_SUMMARY,
    numberFormat: CDC_BT_NUMBER_FORMAT,
    transitNote: CDC_BT_TRANSIT_NOTE,
    doubleValidation: CDC_BT_DOUBLE_VALIDATION_PHASES,
    disputeHours: BT_TRANSFER_DISPUTE_HOURS,
    subtypes: CDC_BT_SUBTYPES,
    signaturePlans: CDC_BT_SUBTYPES.map((s) => ({
      code: s.code,
      slots: btAllSignSlots(s.code),
    })),
  };
}
