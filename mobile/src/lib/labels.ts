export const ORDER_STATUS_LABELS = {
  PENDING: "Non traitée",
  IN_PROGRESS: "Traitée",
  SETTLED: "Soldée",
} as const;

export const DOC_KIND_LABELS: Record<string, string> = {
  ENTRY: "BE",
  EXIT: "BS",
  TRANSFER: "BT",
};
