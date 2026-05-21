import type { DocumentLine } from "@prisma/client";

/** Lignes couvertes par scan RFID (quantité attendue atteinte). */
export function documentLinesRfidComplete(
  lines: Pick<DocumentLine, "expectedQty" | "scannedQty">[],
): boolean {
  if (lines.length === 0) return false;
  return lines.every((l) => l.expectedQty > 0 && l.scannedQty >= l.expectedQty);
}
