"use client";

import { StockDocumentStatus } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  CDC_ORDER_INTERDEPENDENCE_RULES,
  buildOrderInterdependenceStatus,
} from "@/lib/cdc-order-interdependence";
import type { OrderWorkflowState } from "@/lib/cdc-order-workflow";

type Props = {
  workflow: OrderWorkflowState;
  onNavigateToBons?: () => void;
};

function docStatusLabel(status: StockDocumentStatus, rfidComplete: boolean): string {
  if (status === StockDocumentStatus.SIGNED) {
    return rfidComplete ? "Signé · RFID OK" : "Signé · RFID incomplet";
  }
  if (status === StockDocumentStatus.SCANNING) return "Scan en cours";
  if (status === StockDocumentStatus.PENDING_SIGNATURE) {
    return rfidComplete ? "À signer · RFID OK" : "À signer";
  }
  return status;
}

export function OrderInterdependencePanel({ workflow, onNavigateToBons }: Props) {
  const inter = buildOrderInterdependenceStatus({
    orderStatus: workflow.orderStatus,
    bsEvt: workflow.bsEvt,
    beRet: workflow.beRet,
  });

  return (
    <section className="orders-interdep" aria-label="Interdépendance commande et bons">
      <p className="orders-section-title">Articulation avec les bons (CDC)</p>
      <ul className="orders-interdep-rules">
        {CDC_ORDER_INTERDEPENDENCE_RULES.map((rule) => (
          <li key={rule.id}>
            <strong>{rule.title}</strong>
            <span>{rule.summary}</span>
          </li>
        ))}
      </ul>

      <div className="orders-interdep-docs">
        <div className={`orders-interdep-doc${inter.bsSigned ? " orders-interdep-doc--ok" : ""}`}>
          <AppIcon name="documents" size={16} />
          <div>
            <span className="orders-interdep-doc-lbl">BS-EVT (sortie)</span>
            {workflow.bsEvt ? (
              <>
                <span className="orders-interdep-doc-num">{workflow.bsEvt.documentNumber}</span>
                <span className="fs11 text-muted">
                  {docStatusLabel(workflow.bsEvt.status, workflow.bsEvt.rfidComplete)}
                </span>
              </>
            ) : (
              <span className="fs11 text-muted">Généré au chargement</span>
            )}
          </div>
        </div>
        <div
          className={`orders-interdep-doc${inter.canCloseAsSettled ? " orders-interdep-doc--ok" : ""}`}
        >
          <AppIcon name="signature" size={16} />
          <div>
            <span className="orders-interdep-doc-lbl">BE-RET (retour)</span>
            {workflow.beRet ? (
              <>
                <span className="orders-interdep-doc-num">{workflow.beRet.documentNumber}</span>
                <span className="fs11 text-muted">
                  {docStatusLabel(workflow.beRet.status, workflow.beRet.rfidComplete)}
                </span>
              </>
            ) : (
              <span className="fs11 text-muted">Généré au retour prestation</span>
            )}
          </div>
        </div>
      </div>

      {inter.settlementBlockedReason && workflow.orderStatus !== "SETTLED" ? (
        <p className="orders-interdep-warn" role="status">
          <AppIcon name="alert" size={14} />
          {inter.settlementBlockedReason}
        </p>
      ) : null}

      {workflow.orderStatus === "SETTLED" && inter.canCloseAsSettled ? (
        <p className="orders-interdep-ok fs12">
          <AppIcon name="check" size={14} />
          Clôture conforme : BE-RET signé et scan RFID complet.
        </p>
      ) : null}

      {onNavigateToBons && (workflow.bsEvt || workflow.beRet) ? (
        <button type="button" className="btn btn-sm btn-outline btn-icon" onClick={onNavigateToBons}>
          <AppIcon name="documents" size={14} />
          Ouvrir Mouvements de matériel
        </button>
      ) : null}
    </section>
  );
}
