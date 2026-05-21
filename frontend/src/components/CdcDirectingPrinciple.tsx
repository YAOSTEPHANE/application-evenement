"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { DOC_KIND_LABELS } from "@/lib/cdc-labels";
import {
  CDC_7_1_RULE_BODY,
  CDC_7_1_RULE_FOOTNOTE,
  CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS,
  CDC_DIRECTING_PRINCIPLE_SECTION,
  CDC_DIRECTING_PRINCIPLE_TITLE,
  CDC_FUNDAMENTAL_RULE_LABEL,
  CDC_RFID_TRACEABILITY_ADDENDUM,
} from "@/lib/cdc-directing-principle";

type CdcDirectingPrincipleProps = {
  variant?: "banner" | "compact";
  className?: string;
  showRfidAddendum?: boolean;
};

export function CdcDirectingPrinciple({
  variant = "banner",
  className = "",
  showRfidAddendum = true,
}: CdcDirectingPrincipleProps) {
  if (variant === "compact") {
    return (
      <p className={`cdc-principle-compact ${className}`.trim()} role="note">
        <AppIcon name="shield" size={14} />
        <span>
          <strong>{CDC_FUNDAMENTAL_RULE_LABEL} ·</strong> {CDC_7_1_RULE_FOOTNOTE}
        </span>
      </p>
    );
  }

  return (
    <aside
      className={`cdc-principle-banner ${className}`.trim()}
      role="note"
      aria-label={CDC_DIRECTING_PRINCIPLE_TITLE}
    >
      <span className="cdc-principle-icon" aria-hidden>
        <AppIcon name="documents" size={20} />
      </span>
      <div className="cdc-principle-text">
        <p className="cdc-principle-kicker">
          {CDC_DIRECTING_PRINCIPLE_SECTION} · {CDC_DIRECTING_PRINCIPLE_TITLE}
        </p>
        <p className="cdc-principle-rule-label">{CDC_FUNDAMENTAL_RULE_LABEL}</p>
        <p className="cdc-principle-body">{CDC_7_1_RULE_BODY}</p>
        <div className="cdc-principle-kinds" aria-label="Documents autorisés">
          {CDC_ALLOWED_MOVEMENT_DOCUMENT_KINDS.map((kind) => (
            <span key={kind} className="cdc-principle-kind">
              {DOC_KIND_LABELS[kind]}
            </span>
          ))}
        </div>
        <p className="cdc-principle-foot">{CDC_7_1_RULE_FOOTNOTE}</p>
        {showRfidAddendum ? (
          <p className="cdc-principle-addendum">{CDC_RFID_TRACEABILITY_ADDENDUM}</p>
        ) : null}
      </div>
    </aside>
  );
}
