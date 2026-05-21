import {
  MovementType,
  StockDocumentKind,
  StockDocumentStatus,
  type Prisma,
} from "@prisma/client";

import type { MovementCreateInput } from "@/lib/movement-helpers";

export const CDC_DIRECTING_PRINCIPLE_SECTION = "7.1";

export const CDC_7_1_RULE_BODY =
  "Tout mouvement physique de matériel doit être précédé ou accompagné de l'émission d'un document numérique (Bon d'Entrée, Bon de Sortie ou Bon de Transfert) généré et signé via l'application.";

export const CDC_7_1_RULE_FOOTNOTE = "Aucun mouvement non documenté n'est autorisé.";

export const CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS: readonly StockDocumentKind[] = [
  StockDocumentKind.BE,
  StockDocumentKind.BS,
  StockDocumentKind.BT,
];

export const CDC_UNDOCUMENTED_MOVEMENT_CODE = "UNDOCUMENTED_PHYSICAL_MOVEMENT";

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
