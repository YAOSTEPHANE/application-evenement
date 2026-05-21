import type { OrderStatus } from "@prisma/client";

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

export function trioBlockerMessage(trio: TrioValidationState): string | null {
  if (trio.complete) return null;
  const missing: string[] = [];
  if (!trio.stock) missing.push("Stock");
  if (!trio.technical) missing.push("Technique");
  if (!trio.fleet) missing.push("Parc");
  return `Validation trio opérationnel incomplète (${missing.join(", ")}).`;
}
