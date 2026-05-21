import type { OrderStatus, Role } from "@prisma/client";

import {
  canManageFleet,
  canManageHrTeams,
  canManagePhysicalStock,
} from "@/lib/cdc-validation-matrix";

export type OperationalTrioPillar = "stock" | "technical" | "fleet";

export type EventTrioFields = {
  orderStatus: OrderStatus;
  stockValidatedAt: Date | null;
  technicalValidatedAt: Date | null;
  fleetValidatedAt: Date | null;
};

export type TrioValidationState = {
  stock: boolean;
  technical: boolean;
  fleet: boolean;
  complete: boolean;
};

export const TRIO_PILLAR_LABELS: Record<OperationalTrioPillar, string> = {
  stock: "Stock",
  technical: "Technique",
  fleet: "Parc camion",
};

export function getTrioValidationState(event: EventTrioFields): TrioValidationState {
  const stock = Boolean(event.stockValidatedAt);
  const technical = Boolean(event.technicalValidatedAt);
  const fleet = Boolean(event.fleetValidatedAt);
  return {
    stock,
    technical,
    fleet,
    complete: stock && technical && fleet,
  };
}

export function canValidateTrioPillar(role: Role | null, pillar: OperationalTrioPillar): boolean {
  if (!role) return false;
  switch (pillar) {
    case "stock":
      return canManagePhysicalStock(role);
    case "technical":
      return canManageHrTeams(role);
    case "fleet":
      return canManageFleet(role);
    default:
      return false;
  }
}

export function trioBlockerMessage(trio: TrioValidationState): string | null {
  if (trio.complete) return null;
  const missing: string[] = [];
  if (!trio.stock) missing.push("Stock");
  if (!trio.technical) missing.push("Technique");
  if (!trio.fleet) missing.push("Parc");
  return `Validation trio opérationnel incomplète (${missing.join(", ")}).`;
}

export function fieldForTrioPillar(pillar: OperationalTrioPillar): {
  at: "stockValidatedAt" | "technicalValidatedAt" | "fleetValidatedAt";
  userId: "stockValidatedByUserId" | "technicalValidatedByUserId" | "fleetValidatedByUserId";
} {
  switch (pillar) {
    case "stock":
      return { at: "stockValidatedAt", userId: "stockValidatedByUserId" };
    case "technical":
      return { at: "technicalValidatedAt", userId: "technicalValidatedByUserId" };
    case "fleet":
      return { at: "fleetValidatedAt", userId: "fleetValidatedByUserId" };
  }
}
