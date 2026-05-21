import {
  BeSubtype,
  BsSubtype,
  OrderStatus,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";

import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";
import { getTrioValidationState } from "@/lib/cdc-order-trio";
import { prisma } from "@/lib/prisma";

export type OrderStatusChangeResult = { ok: true } | { ok: false; message: string };

/** Transitions commande CDC — alignées sur BS-EVT et BE-RET signés. */
export async function validateOrderStatusChange(
  organizationId: string,
  eventId: string,
  next: OrderStatus,
  current: OrderStatus,
): Promise<OrderStatusChangeResult> {
  if (next === current) {
    return { ok: true };
  }

  if (current === OrderStatus.SETTLED && next !== OrderStatus.SETTLED) {
    return { ok: false, message: "Une commande soldée ne peut pas être rouverte." };
  }

  if (next === OrderStatus.SETTLED) {
    const beRet = await prisma.stockDocument.findFirst({
      where: {
        organizationId,
        eventId,
        kind: StockDocumentKind.BE,
        beSubtype: BeSubtype.BE_RET,
        status: StockDocumentStatus.SIGNED,
      },
      include: { lines: true },
    });
    if (!beRet) {
      return {
        ok: false,
        message: "Statut « Soldée » impossible sans BE-RET signé et scan RFID complet.",
      };
    }
    if (!documentLinesRfidComplete(beRet.lines)) {
      return {
        ok: false,
        message:
          "BE-RET incomplet — réintégration totale validée par scan RFID sur chaque ligne.",
      };
    }
    return { ok: true };
  }

  if (next === OrderStatus.IN_PROGRESS && current === OrderStatus.PENDING) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: {
        stockValidatedAt: true,
        technicalValidatedAt: true,
        fleetValidatedAt: true,
        orderStatus: true,
      },
    });
    if (!event) {
      return { ok: false, message: "Commande introuvable." };
    }
    if (!getTrioValidationState(event).complete) {
      return {
        ok: false,
        message:
          "Passage « Traitée » impossible sans validation Stock, Technique et Parc.",
      };
    }
    const bsEvt = await prisma.stockDocument.findFirst({
      where: {
        organizationId,
        eventId,
        kind: StockDocumentKind.BS,
        bsSubtype: BsSubtype.BS_EVT,
        status: StockDocumentStatus.SIGNED,
      },
    });
    if (!bsEvt) {
      return {
        ok: false,
        message:
          "Passage « Traitée » requiert un BS-EVT signé (matériel sorti et documenté).",
      };
    }
    return { ok: true };
  }

  return { ok: true };
}
