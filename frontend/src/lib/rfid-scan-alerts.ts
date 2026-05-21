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

/** Bip court pour alerte portique (navigateur / back-office). */
export function playRfidAlertSound(level: RfidScanAlertLevel): void {
  if (level === "ok" || typeof window === "undefined") {
    return;
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = level === "error" ? 440 : 660;
    gain.gain.value = 0.12;
    osc.start();
    osc.stop(ctx.currentTime + (level === "error" ? 0.35 : 0.2));
    void ctx.close();
  } catch {
    /* Audio non disponible */
  }
}
