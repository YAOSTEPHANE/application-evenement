import type { OrderStatus } from "@prisma/client";

/**
 * CDC §6.1 — Cycle de vie obligatoire d'une commande (3 statuts distincts).
 * Source produit : libellés UI via `cdc-labels.ts` (ORDER_STATUS_*).
 */

export type OrderLifecycleStep = {
  status: OrderStatus;
  /** Libellé CDC complet */
  label: string;
  /** Libellé court (kanban, badges) */
  shortLabel: string;
  /** Signification métier CDC */
  signification: string;
  /** Ordre dans le cycle (1 → 3) */
  order: number;
};

export const CDC_ORDER_LIFECYCLE: readonly OrderLifecycleStep[] = [
  {
    status: "PENDING",
    label: "En cours / Non traitée",
    shortLabel: "Non traitée",
    signification:
      "Commande saisie par un commercial, en attente de validation par le trio opérationnel (Stock, Technique, Parc).",
    order: 1,
  },
  {
    status: "IN_PROGRESS",
    label: "En cours / Traitée",
    shortLabel: "Traitée",
    signification:
      "Matériel sorti et déployé sur le site événementiel, prestation en cours.",
    order: 2,
  },
  {
    status: "SETTLED",
    label: "Soldée",
    shortLabel: "Soldée",
    signification: "Matériel intégralement réintégré en stock, commande clôturée.",
    order: 3,
  },
] as const;

const BY_STATUS = new Map(CDC_ORDER_LIFECYCLE.map((s) => [s.status, s]));

export function getOrderLifecycleStep(status: OrderStatus): OrderLifecycleStep {
  return BY_STATUS.get(status) ?? CDC_ORDER_LIFECYCLE[0];
}

/** Transitions autorisées (statut commande uniquement — pas de retour arrière depuis Soldée). */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["SETTLED"],
  SETTLED: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
