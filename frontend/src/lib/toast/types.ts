export type ToastType = "ok" | "danger" | "warn" | "info" | "default";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  durationMs: number;
};

export type ShowToastOptions = {
  type?: ToastType;
  title?: string;
  /** Durée d'affichage en ms (défaut selon le type). */
  durationMs?: number;
};
