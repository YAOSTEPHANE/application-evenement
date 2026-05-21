"use client";

import { BsSubtype, type StockDocumentStatus } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  CDC_BS_EVT_TRIPLE_SIGNATURES,
  CDC_BS_PORTIQUE_CONTROL,
  CDC_BS_SUBTYPES,
  CDC_BS_SUMMARY,
  requiresTripleSignature,
  type BsDocumentProgressInput,
} from "@/lib/cdc-bs-document";

type Props = {
  variant?: "overview" | "detail";
  bsSubtype?: BsSubtype | null;
};

export function BsDocumentGuide({ variant = "overview", bsSubtype }: Props) {
  if (variant === "overview") {
    return (
      <section className="bs-guide bs-guide--overview" aria-label="Bon de sortie CDC">
        <p className="bs-guide-summary">{CDC_BS_SUMMARY}</p>
        <div className="bs-guide-subtypes">
          {CDC_BS_SUBTYPES.map((st) => (
            <article key={st.code} className="bs-guide-subtype-card">
              <span className="bs-guide-code">{st.label}</span>
              <p className="bs-guide-desc">{st.description}</p>
              <span className="bs-guide-validator">{st.principalValidator}</span>
            </article>
          ))}
        </div>
        <div className="bs-guide-portique">
          <AppIcon name="scan" size={16} />
          <p>{CDC_BS_PORTIQUE_CONTROL}</p>
        </div>
      </section>
    );
  }

  const showTriple = requiresTripleSignature(bsSubtype);

  return (
    <div className="bs-guide-detail">
      {showTriple ? (
        <div className="bs-guide-triple">
          <p className="fs12 fw500">Triple signature obligatoire (BS-EVT)</p>
          <ol className="bs-guide-triple-list">
            {CDC_BS_EVT_TRIPLE_SIGNATURES.map((s) => (
              <li key={s.order}>
                <strong>{s.order}.</strong> {s.label}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="bs-guide-portique bs-guide-portique--compact">
        <AppIcon name="warehouse" size={14} />
        <span className="fs12">{CDC_BS_PORTIQUE_CONTROL}</span>
      </div>
    </div>
  );
}

export function bsProgressFromDetail(detail: {
  kind: string;
  status: keyof typeof StockDocumentStatus;
  bsSubtype?: BsSubtype | null;
  lines: Array<{ expectedQty: number; scannedQty: number }>;
  signatures: unknown[];
  signatureMeta?: { needed: number; rfidOk?: boolean } | null;
}): { step: number; rfidOk: boolean } {
  if (detail.kind !== "BS") return { step: 0, rfidOk: false };
  const rfidOk = detail.signatureMeta?.rfidOk ?? false;
  if (detail.status === "SIGNED") return { step: 5, rfidOk };
  if (detail.status === "CANCELLED") return { step: 0, rfidOk };
  if (!rfidOk && detail.status === "DRAFT") return { step: 1, rfidOk };
  if (!rfidOk || detail.status === "SCANNING") return { step: 2, rfidOk };
  if (detail.status === "PENDING_SIGNATURE") return { step: 4, rfidOk };
  return { step: 3, rfidOk };
}
