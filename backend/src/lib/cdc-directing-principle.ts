import {
  MovementType,
  StockDocumentKind,
  StockDocumentStatus,
  type Prisma,
} from "@prisma/client";

import type { MovementCreateInput } from "@/lib/movement-helpers";

export const CDC_DIRECTING_PRINCIPLE_SECTION = "7.1";

export const CDC_DIRECTING_PRINCIPLE_TITLE = "Principe directeur";

export const CDC_FUNDAMENTAL_RULE_LABEL = "Règle fondamentale";

export const CDC_RFID_TRACEABILITY_ADDENDUM =
  "Chaque article concerné doit être identifié par RFID ; le bon signé fait foi du mouvement physique.";

export const CDC_7_1_RULE_BODY =
  "Tout mouvement physique de matériel doit être précédé ou accompagné de l'émission d'un document numérique (Bon d'Entrée, Bon de Sortie ou Bon de Transfert) généré et signé via l'application.";

export const CDC_7_1_RULE_FOOTNOTE = "Aucun mouvement non documenté n'est autorisé.";

export const CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS: readonly StockDocumentKind[] = [
  StockDocumentKind.BE,
  StockDocumentKind.BS,
  StockDocumentKind.BT,
];

export const CDC_UNDOCUMENTED_MOVEMENT_CODE = "UNDOCUMENTED_PHYSICAL_MOVEMENT";

export type DirectingPrinciplePublic = {
  section: string;
  title: string;
  fundamentalRuleLabel: string;
  body: string;
  footnote: string;
  rfidAddendum: string;
  allowedDocumentKinds: StockDocumentKind[];
  enforced: boolean;
};

export function getDirectingPrinciplePublic(): DirectingPrinciplePublic {
  return {
    section: CDC_DIRECTING_PRINCIPLE_SECTION,
    title: CDC_DIRECTING_PRINCIPLE_TITLE,
    fundamentalRuleLabel: CDC_FUNDAMENTAL_RULE_LABEL,
    body: CDC_7_1_RULE_BODY,
    footnote: CDC_7_1_RULE_FOOTNOTE,
    rfidAddendum: CDC_RFID_TRACEABILITY_ADDENDUM,
    allowedDocumentKinds: [...CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS],
    enforced: isDirectingPrincipleEnforced(),
  };
}

export function isDirectingPrincipleEnforced(): boolean {
  const raw = process.env.CDC_ENFORCE_DIRECTING_PRINCIPLE?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

export function movementSubjectToDirectingPrinciple(payload: MovementCreateInput): boolean {
  switch (payload.movementType) {
    case MovementType.OUTBOUND:
      return true;
    case MovementType.TRANSFER:
      return true;
    case MovementType.INBOUND:
      return Boolean(payload.toWarehouseId || payload.toStorageLocationId);
    default:
      return false;
  }
}

export type MovementComplianceInput = MovementCreateInput & {
  stockDocumentId?: string;
  cdcCorrection?: boolean;
  cdcCorrectionNote?: string;
};

const CORRECTION_ROLES = new Set(["ADMIN", "MANAGER", "STOREKEEPER"]);

export function canRecordUndocumentedCorrection(role: string): boolean {
  return CORRECTION_ROLES.has(role);
}

export async function assertMovementCompliesWithDirectingPrinciple(
  tx: Prisma.TransactionClient,
  organizationId: string,
  actorRole: string,
  payload: MovementComplianceInput,
): Promise<void> {
  if (!movementSubjectToDirectingPrinciple(payload)) {
    return;
  }

  if (payload.stockDocumentId) {
    const doc = await tx.stockDocument.findFirst({
      where: {
        id: payload.stockDocumentId,
        organizationId,
        status: StockDocumentStatus.SIGNED,
        kind: { in: [...CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS] },
      },
      select: { id: true },
    });
    if (!doc) {
      throw new Error(
        "Le bon référencé est introuvable, non signé ou n'est pas un BE/BS/BT.",
      );
    }
    return;
  }

  if (payload.cdcCorrection && canRecordUndocumentedCorrection(actorRole)) {
    const note = payload.cdcCorrectionNote?.trim();
    if (!note || note.length < 8) {
      throw new Error(
        "Pour corriger un dysfonctionnement, décrivez la régularisation (8 caractères minimum).",
      );
    }
    return;
  }

  if (!isDirectingPrincipleEnforced()) {
    return;
  }

  const err = new Error(
    `${CDC_7_1_RULE_BODY} ${CDC_7_1_RULE_FOOTNOTE} Créez et signez un bon BE, BS ou BT.`,
  );
  (err as Error & { code?: string }).code = CDC_UNDOCUMENTED_MOVEMENT_CODE;
  throw err;
}
