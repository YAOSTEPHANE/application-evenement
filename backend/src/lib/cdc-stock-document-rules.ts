import { createHmac } from "crypto";

import { StockDocumentKind, StockDocumentStatus } from "@prisma/client";

export const STOCK_DOCUMENT_RETENTION_YEARS = 10;

/** Empreinte document (intégrité archive CDC). */
export function hashDocumentContent(html: string): string {
  return createHmac("sha256", process.env.AUTH_JWT_SECRET ?? "archive-key")
    .update(html)
    .digest("hex");
}

export function archiveRetentionUntil(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + STOCK_DOCUMENT_RETENTION_YEARS);
  return d;
}

export function isStockDocumentImmutable(status: StockDocumentStatus): boolean {
  return status === StockDocumentStatus.SIGNED || status === StockDocumentStatus.CANCELLED;
}

export function assertStockDocumentMutable(
  status: StockDocumentStatus,
): { ok: true } | { ok: false; message: string } {
  if (status === StockDocumentStatus.SIGNED) {
    return { ok: false, message: "Bon signé — modification interdite (§7.5)." };
  }
  if (status === StockDocumentStatus.CANCELLED) {
    return { ok: false, message: "Bon annulé — lecture seule." };
  }
  return { ok: true };
}

export function getStockDocumentRulesPublicSpec() {
  return { section: "7.5", title: "Règles transverses aux bons", retentionYears: 10 };
}
