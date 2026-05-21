import {
  BeSubtype,
  BsSubtype,
  OrderStatus,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";

import { getTrioValidationState, trioBlockerMessage } from "@/lib/cdc-order-trio";
import { documentLinesRfidComplete } from "@/lib/document-line-helpers";
import { prisma } from "@/lib/prisma";

export { documentLinesRfidComplete };

export type LinkedStockDoc = {
  id: string;
  documentNumber: string;
  status: StockDocumentStatus;
  rfidComplete: boolean;
  signedAt: string | null;
};

export type OrderWorkflowState = {
  orderStatus: OrderStatus;
  trio: ReturnType<typeof getTrioValidationState>;
  bsEvt: LinkedStockDoc | null;
  beRet: LinkedStockDoc | null;
  canStartLoading: boolean;
  canStartReturn: boolean;
  canSettle: boolean;
  blockers: string[];
  /** Prochaine action métier recommandée (CDC interdépendance). */
  nextAction: { label: string; endpoint: string; method: "POST" } | null;
};

export async function getOrderWorkflowState(
  organizationId: string,
  eventId: string,
): Promise<OrderWorkflowState> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: {
      eventItems: { select: { id: true } },
    },
  });

  if (!event) {
    throw new Error("Commande introuvable");
  }

  const documents = await prisma.stockDocument.findMany({
    where: { organizationId, eventId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  const bsEvtDoc = documents.find(
    (d) => d.kind === StockDocumentKind.BS && d.bsSubtype === BsSubtype.BS_EVT,
  );
  const beRetDoc = documents.find(
    (d) => d.kind === StockDocumentKind.BE && d.beSubtype === BeSubtype.BE_RET,
  );

  const mapDoc = (doc: (typeof documents)[0] | undefined): LinkedStockDoc | null => {
    if (!doc) return null;
    return {
      id: doc.id,
      documentNumber: doc.documentNumber,
      status: doc.status,
      rfidComplete: documentLinesRfidComplete(doc.lines),
      signedAt: doc.signedAt?.toISOString() ?? null,
    };
  };

  const bsEvt = mapDoc(bsEvtDoc);
  const beRet = mapDoc(beRetDoc);
  const trio = getTrioValidationState(event);
  const hasMaterial = event.eventItems.length > 0;
  const bsSigned = bsEvt?.status === StockDocumentStatus.SIGNED;
  const beRetSigned = beRet?.status === StockDocumentStatus.SIGNED;
  const blockers: string[] = [];

  if (!hasMaterial) {
    blockers.push("Aucun matériel réservé sur la commande.");
  }

  if (event.orderStatus === OrderStatus.PENDING) {
    const trioMsg = trioBlockerMessage(trio);
    if (trioMsg) blockers.push(trioMsg);
    if (!bsSigned) {
      if (!bsEvt) {
        blockers.push("BS-EVT requis au chargement (génération automatique).");
      } else if (bsEvt.status !== StockDocumentStatus.SIGNED) {
        if (!bsEvt.rfidComplete) {
          blockers.push("Scan RFID du BS-EVT incomplet avant signature.");
        } else {
          blockers.push("BS-EVT en attente de signature(s).");
        }
      }
    }
  }

  if (event.orderStatus === OrderStatus.IN_PROGRESS) {
    if (!bsSigned) {
      blockers.push("BS-EVT signé manquant — sortie non documentée.");
    }
    if (!beRet) {
      blockers.push("BE-RET obligatoire au retour du matériel.");
    } else if (!beRetSigned) {
      if (!beRet.rfidComplete) {
        blockers.push("Scan RFID du BE-RET incomplet — réintégration totale requise.");
      } else {
        blockers.push("BE-RET en attente de signature(s).");
      }
    }
  }

  if (event.orderStatus === OrderStatus.SETTLED) {
    if (!beRetSigned || !beRet?.rfidComplete) {
      blockers.push("Soldée sans BE-RET RFID complet (anomalie).");
    }
  }

  const canStartLoading =
    event.orderStatus === OrderStatus.PENDING &&
    trio.complete &&
    hasMaterial &&
    !bsSigned &&
    (!bsEvt ||
      (bsEvt.status !== StockDocumentStatus.SIGNED &&
        bsEvt.status !== StockDocumentStatus.CANCELLED));

  const canStartReturn =
    event.orderStatus === OrderStatus.IN_PROGRESS &&
    bsSigned &&
    (!beRet ||
      (beRet.status !== StockDocumentStatus.SIGNED &&
        beRet.status !== StockDocumentStatus.CANCELLED));

  const canSettle =
    event.orderStatus === OrderStatus.IN_PROGRESS &&
    beRetSigned &&
    Boolean(beRet?.rfidComplete);

  let nextAction: OrderWorkflowState["nextAction"] = null;
  if (canStartLoading) {
    nextAction = {
      label: "Démarrer chargement (BS-EVT auto)",
      endpoint: `/api/events/${eventId}/loading`,
      method: "POST",
    };
  } else if (
    bsEvt &&
    bsEvt.status !== StockDocumentStatus.SIGNED &&
    event.orderStatus === OrderStatus.PENDING
  ) {
    nextAction = {
      label: "Scanner / signer le BS-EVT",
      endpoint: `/api/stock-documents/${bsEvt.id}`,
      method: "POST",
    };
  } else if (canStartReturn) {
    nextAction = {
      label: "Démarrer retour (BE-RET auto)",
      endpoint: `/api/events/${eventId}/return`,
      method: "POST",
    };
  } else if (
    beRet &&
    beRet.status !== StockDocumentStatus.SIGNED &&
    event.orderStatus === OrderStatus.IN_PROGRESS
  ) {
    nextAction = {
      label: "Scanner / signer le BE-RET",
      endpoint: `/api/stock-documents/${beRet.id}`,
      method: "POST",
    };
  }

  return {
    orderStatus: event.orderStatus,
    trio,
    bsEvt,
    beRet,
    canStartLoading,
    canStartReturn,
    canSettle,
    blockers,
    nextAction,
  };
}
