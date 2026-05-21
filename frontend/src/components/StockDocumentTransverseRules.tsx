"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { CDC_STOCK_DOCUMENT_RULES, CDC_STOCK_RULES_TITLE } from "@/lib/cdc-stock-document-rules";

type Props = {
  variant?: "banner" | "compact";
};

export function StockDocumentTransverseRules({ variant = "banner" }: Props) {
  if (variant === "compact") {
    return (
      <p className="doc-rules-compact" role="note">
        <AppIcon name="shield" size={14} />
        <span>§7.5 — Numérotation serveur, pas de suppression, archive 10 ans, PDF signé, immuabilité.</span>
      </p>
    );
  }

  return (
    <aside className="doc-rules-banner" aria-label={CDC_STOCK_RULES_TITLE}>
      <h3 className="doc-rules-title">
        <AppIcon name="documents" size={16} />
        {CDC_STOCK_RULES_TITLE} <span className="doc-rules-tag">§7.5</span>
      </h3>
      <ul className="doc-rules-list">
        {CDC_STOCK_DOCUMENT_RULES.map((r) => (
          <li key={r.id}>
            <strong>{r.label}</strong> — {r.description}
          </li>
        ))}
      </ul>
    </aside>
  );
}
