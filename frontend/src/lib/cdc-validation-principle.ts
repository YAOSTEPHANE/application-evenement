import { StockDocumentKind } from "@prisma/client";

import { ROLE_LABELS } from "@/lib/cdc-labels";
import {
  documentSignPlan,
  MATRIX_ROLES,
  SENSITIVE_ACTIONS,
  VALIDATION_DOC_SCENARIOS,
  type SignSlot,
  type ValidationDocScenario,
} from "@/lib/cdc-validation-matrix";

/** §10.1 — Principe de la matrice de validation (référentiel CDC, hors dashboard). */
export const CDC_VALIDATION_PRINCIPLE_REF = "10.1";

export const CDC_VALIDATION_PRINCIPLE =
  "Chaque action critique du système requiert une ou plusieurs signatures électroniques selon une matrice formalisée. La matrice garantit que les bonnes personnes sont impliquées dans chaque opération.";

export type CriticalActionDef = {
  id: string;
  label: string;
  description: string;
  /** Lié à la matrice des signatures sur bons. */
  usesSignatureMatrix: boolean;
  /** Complément 2FA pour rôles sensibles. */
  mayRequire2Fa: boolean;
};

/** Actions critiques au-delà des seules signatures document par document. */
export const CDC_CRITICAL_ACTIONS: readonly CriticalActionDef[] = [
  {
    id: "sign_stock_document",
    label: "Signature bon BE / BS / BT",
    description:
      "Chaque étape de validation d'un bon suit la matrice (rôle et ordre imposés).",
    usesSignatureMatrix: true,
    mayRequire2Fa: true,
  },
  {
    id: "operational_trio",
    label: "Validation trio commande",
    description:
      "Avant BS-EVT : validation Stock, Technique et Parc (horodatage responsable).",
    usesSignatureMatrix: false,
    mayRequire2Fa: false,
  },
  {
    id: "create_stock_document",
    label: "Création bon numérique",
    description: "Droit de création par profil (matrice des droits §10).",
    usesSignatureMatrix: false,
    mayRequire2Fa: true,
  },
  {
    id: "cancel_or_contra",
    label: "Annulation / contre-passation",
    description: "Bon contraire ou annulation — profils autorisés + 2FA si activée.",
    usesSignatureMatrix: false,
    mayRequire2Fa: true,
  },
  {
    id: "dispute_arbitration",
    label: "Arbitrage litige transfert",
    description: "Clôture litige BT (§7.4.2) — administration uniquement.",
    usesSignatureMatrix: false,
    mayRequire2Fa: true,
  },
] as const;

export type SignatureMatrixRow = {
  scenarioId: string;
  label: string;
  kind: StockDocumentKind;
  signatureCount: number;
  slots: Array<{ order: number; role: string; roleLabel: string; label: string }>;
};

function buildSignatureMatrixRow(scenario: ValidationDocScenario): SignatureMatrixRow {
  const slots = documentSignPlan(scenario.kind, {
    beSubtype: scenario.beSubtype ?? null,
    bsSubtype: scenario.bsSubtype ?? null,
    btSubtype: scenario.btSubtype ?? null,
  });
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    kind: scenario.kind,
    signatureCount: slots.length,
    slots: slots.map((slot: SignSlot, index) => ({
      order: index + 1,
      role: slot.role,
      roleLabel: ROLE_LABELS[slot.role],
      label: slot.label,
    })),
  };
}

export function getValidationMatrixCatalog() {
  return {
    ref: CDC_VALIDATION_PRINCIPLE_REF,
    principle: CDC_VALIDATION_PRINCIPLE,
    criticalActions: CDC_CRITICAL_ACTIONS.map((a) => ({ ...a })),
    sensitiveActions: SENSITIVE_ACTIONS.map((a) => ({ ...a })),
    profiles: MATRIX_ROLES.map((role) => ({
      role,
      label: ROLE_LABELS[role],
    })),
    signatureMatrix: VALIDATION_DOC_SCENARIOS.map(buildSignatureMatrixRow),
  };
}
