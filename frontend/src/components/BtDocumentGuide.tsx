"use client";

import type { BtSubtype } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  BT_TRANSFER_DISPUTE_HOURS,
  CDC_BT_DOUBLE_VALIDATION_PHASES,
  CDC_BT_SUBTYPES,
  CDC_BT_SUMMARY,
  CDC_BT_TRANSIT_NOTE,
  btAllSignSlots,
} from "@/lib/cdc-bt-document";

type Props = {
  variant?: "overview" | "detail";
  btSubtype?: BtSubtype | null;
};

export function BtDocumentGuide({ variant = "overview", btSubtype }: Props) {
  if (variant === "overview") {
    return (
      <section className="bt-guide bt-guide--overview" aria-label="Bon de transfert CDC">
        <p className="bt-guide-summary">{CDC_BT_SUMMARY}</p>
        <div className="bt-guide-subtypes">
          {CDC_BT_SUBTYPES.map((st) => (
            <article key={st.code} className="bt-guide-subtype-card">
              <span className="bt-guide-code">{st.label}</span>
              <p className="bt-guide-use">{st.useCase}</p>
              <span className="bt-guide-validation">{st.validation}</span>
            </article>
          ))}
        </div>
        <div className="bt-guide-phases">
          {CDC_BT_DOUBLE_VALIDATION_PHASES.map((ph) => (
            <div key={ph.id} className="bt-guide-phase">
              <span className="bt-guide-phase-title">{ph.title}</span>
              <p className="bt-guide-phase-desc">{ph.description}</p>
            </div>
          ))}
        </div>
        <div className="bt-guide-transit">
          <AppIcon name="sync" size={16} />
          <p>{CDC_BT_TRANSIT_NOTE}</p>
        </div>
      </section>
    );
  }

  const plan = btAllSignSlots(btSubtype);

  return (
    <div className="bt-guide-detail">
      <p className="fs12 fw500">Processus §7.4.2</p>
      <ol className="bt-guide-phase-list">
        {CDC_BT_DOUBLE_VALIDATION_PHASES.map((ph) => (
          <li key={ph.id}>
            <strong>{ph.title}</strong> — {ph.description}
          </li>
        ))}
      </ol>
      <p className="fs12 fw500 mt8">Signatures attendues</p>
      <ol className="bt-guide-sig-list">
        {plan.map((slot, i) => (
          <li key={`${slot.role}-${i}`}>
            <strong>{i + 1}.</strong> {slot.label}
          </li>
        ))}
      </ol>
      <p className="fs11 text-muted">
        Litige de transfert : arbitrage administrateur sous {BT_TRANSFER_DISPUTE_HOURS} h en cas
        d&apos;écart expédié / reçu.
      </p>
    </div>
  );
}
