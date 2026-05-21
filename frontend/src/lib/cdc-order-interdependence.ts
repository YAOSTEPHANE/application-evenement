import type { OrderStatus } from "@prisma/client";

import type { LinkedStockDoc } from "@/lib/cdc-order-workflow";

/**
 * CDC §6.3 — Articulation commandes ↔ mouvements de matériel (interdépendance).
 */

export type OrderInterdependenceRule = {
  id: "loading_bs" | "return_be_ret" | "settlement_rfid";
  title: string;
  summary: string;
  trigger: string;
  module: "commandes" | "bons";
};

export const CDC_ORDER_INTERDEPENDENCE_SUMMARY =
  "Une commande validée déclenche automatiquement un BS à la sortie (chargement) et impose un BE-RET au retour. « Soldée » uniquement après réintégration totale validée par scan RFID.";

export const CDC_ORDER_INTERDEPENDENCE_RULES: readonly OrderInterdependenceRule[] = [
  {
    id: "loading_bs",
    title: "Chargement → BS-EVT automatique",
    summary:
      "Au démarrage du chargement, génération du Bon de Sortie événement (BS-EVT) à partir des lignes de commande.",
    trigger: "POST /api/events/:id/loading",
    module: "bons",
  },
  {
    id: "return_be_ret",
    title: "Retour → BE-RET obligatoire",
    summary:
      "Au retour du matériel, génération du Bon d'Entrée retour prestation (BE-RET) reprenant les sorties documentées.",
    trigger: "POST /api/events/:id/return",
    module: "bons",
  },
  {
    id: "settlement_rfid",
    title: "Clôture → scan RFID complet",
    summary:
      "Le statut « Soldée » n'est appliqué qu'après signature du BE-RET et scan RFID couvrant toutes les lignes attendues.",
    trigger: "Signature BE-RET (module Mouvements de matériel)",
    module: "bons",
  },
] as const;

export type OrderInterdependenceStatus = {
  orderStatus: OrderStatus;
  bsEvt: LinkedStockDoc | null;
  beRet: LinkedStockDoc | null;
  /** BS-EVT signé → commande peut passer « Traitée » */
  bsSigned: boolean;
  /** BE-RET signé + RFID complet → « Soldée » (automatique à la signature) */
  canCloseAsSettled: boolean;
  /** Blocage explicite clôture sans RFID */
  settlementBlockedReason: string | null;
};

export function buildOrderInterdependenceStatus(input: {
  orderStatus: OrderStatus;
  bsEvt: LinkedStockDoc | null;
  beRet: LinkedStockDoc | null;
}): OrderInterdependenceStatus {
  const bsSigned = input.bsEvt?.status === "SIGNED";
  const beRetSigned = input.beRet?.status === "SIGNED";
  const rfidOk = Boolean(input.beRet?.rfidComplete);

  let settlementBlockedReason: string | null = null;
  if (input.orderStatus !== "SETTLED") {
    if (!beRetSigned) {
      settlementBlockedReason = "BE-RET signé requis avant clôture.";
    } else if (!rfidOk) {
      settlementBlockedReason =
        "Scan RFID du BE-RET incomplet — réintégration totale requise pour « Soldée ».";
    }
  }

  return {
    orderStatus: input.orderStatus,
    bsEvt: input.bsEvt,
    beRet: input.beRet,
    bsSigned,
    canCloseAsSettled: beRetSigned && rfidOk,
    settlementBlockedReason,
  };
}
