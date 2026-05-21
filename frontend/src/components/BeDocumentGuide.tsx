"use client";

import { BeSubtype, type StockDocumentStatus } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  CDC_BE_MANDATORY_FIELDS,
  CDC_BE_PROCESSING_STEPS,
  CDC_BE_SUBTYPES,
  CDC_BE_SUMMARY,
  resolveBeProcessingStepIndex,
  type BeDocumentProgressInput,
} from "@/lib/cdc-be-document";

type Props = {
  variant?: "overview" | "detail";
  activeStep?: number;
};

export function BeDocumentGuide({ variant = "overview", activeStep }: Props) {
  if (variant === "overview") {
    return (
      <section className="be-guide be-guide--overview" aria-label="Bon d'entrée CDC">
        <p className="be-guide-summary">{CDC_BE_SUMMARY}</p>
        <div className="be-guide-subtypes">
          {CDC_BE_SUBTYPES.map((st) => (
            <article key={st.code} className="be-guide-subtype-card">
              <span className="be-guide-code">{st.label}</span>
              <p className="be-guide-desc">{st.description}</p>
              <span className="be-guide-emitter">{st.emitter}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  const step = activeStep ?? 1;
  return (
    <div className="be-guide-steps" aria-label="Processus BE">
      {CDC_BE_PROCESSING_STEPS.map((s) => (
        <div
          key={s.id}
          className={`be-guide-step${s.order === step ? " be-guide-step--active" : ""}${
            s.order < step ? " be-guide-step--done" : ""
          }`}
        >
          <span className="be-guide-step-num">{s.order}</span>
          <div>
            <span className="be-guide-step-title">{s.title}</span>
            <span className="be-guide-step-desc">{s.description}</span>
          </div>
          {s.order < step ? <AppIcon name="check" size={14} /> : null}
        </div>
      ))}
    </div>
  );
}

export function beProgressFromDetail(detail: {
  kind: string;
  status: keyof typeof StockDocumentStatus;
  beSubtype?: BeSubtype | null;
  eventId?: string | null;
  toWarehouse?: { id: string } | null;
  shipper?: { id: string } | null;
  receiver?: { id: string } | null;
  sourceReference?: string | null;
  lines: Array<{
    expectedQty: number;
    scannedQty: number;
    receivedQty: number;
    lineCondition?: string | null;
  }>;
  signatures: unknown[];
  signatureMeta?: { needed: number } | null;
}): number {
  if (detail.kind !== "BE" || !detail.beSubtype) return 0;
  const input: BeDocumentProgressInput = {
    status: detail.status as StockDocumentStatus,
    beSubtype: detail.beSubtype,
    eventId: detail.eventId ?? null,
    toWarehouseId: detail.toWarehouse?.id ?? null,
    shipperUserId: detail.shipper?.id ?? null,
    receiverUserId: detail.receiver?.id ?? null,
    sourceReference: detail.sourceReference ?? null,
    lines: detail.lines.map((l) => ({
      expectedQty: l.expectedQty,
      scannedQty: l.scannedQty,
      receivedQty: l.receivedQty,
      lineCondition: l.lineCondition ?? null,
    })),
    signatureCount: detail.signatures.length,
    signaturesRequired: detail.signatureMeta?.needed ?? 2,
  };
  return resolveBeProcessingStepIndex(input);
}

export function BeMandatoryFieldsHint() {
  return (
    <ul className="be-guide-mandatory">
      {CDC_BE_MANDATORY_FIELDS.map((f) => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  );
}
