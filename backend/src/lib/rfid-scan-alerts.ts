import type { StockDocumentStatus } from "@prisma/client";

import type { RfidScanAlert, RfidScanAlertLevel } from "@/lib/rfid-reading-equipment";

export function buildPortalScanAlert(input: {
  allowed: boolean;
  status?: StockDocumentStatus | null;
  message: string;
  documentNumber?: string | null;
  unknownTags?: string[];
}): RfidScanAlert {
  const hasUnknown = (input.unknownTags?.length ?? 0) > 0;
  const disputed = input.status === "DISPUTED";
  const blocked = !input.allowed || disputed;

  let level: RfidScanAlertLevel = "ok";
  if (blocked) {
    level = "error";
  } else if (hasUnknown) {
    level = "warning";
  }

  const title = blocked
    ? "Écart détecté — passage bloqué"
    : hasUnknown
      ? "Scan enregistré avec réserves"
      : "Passage conforme";

  const detail = input.documentNumber
    ? `${input.message} · ${input.documentNumber}`
    : input.message;

  return {
    level,
    sound: blocked,
    visual: blocked || hasUnknown,
    title,
    detail,
  };
}
