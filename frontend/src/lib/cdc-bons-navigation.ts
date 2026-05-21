/** Navigation inter-pages vers Mouvements de matériel (wizard ou détail bon). */

export const CDC_BONS_FLOW_KEY = "stockevent_bons_flow";

export type CdcBonsFlowIntent = {
  openDocumentId?: string;
  openWizard?: boolean;
  kind?: "BE" | "BS" | "BT";
  bsSubtype?: string;
  beSubtype?: string;
  eventId?: string;
};

export function stashCdcBonsFlow(intent: CdcBonsFlowIntent): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CDC_BONS_FLOW_KEY, JSON.stringify(intent));
}

export function consumeCdcBonsFlow(): CdcBonsFlowIntent | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CDC_BONS_FLOW_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(CDC_BONS_FLOW_KEY);
  try {
    return JSON.parse(raw) as CdcBonsFlowIntent;
  } catch {
    return null;
  }
}
