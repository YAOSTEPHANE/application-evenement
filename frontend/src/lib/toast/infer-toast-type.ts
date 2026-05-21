import type { ToastType } from "@/lib/toast/types";

const ERROR_HINTS = /échec|impossible|refus|erreur|invalide|introuvable|obligatoire|requis/i;
const OK_HINTS = /enregistré|créé|mis à jour|supprimé|validé|signé|synchronis|transmis|importé|activé|désactivé|terminée|ok\b/i;

/** Déduit le ton du toast à partir du libellé (fallback neutre). */
export function inferToastType(message: string, explicit?: ToastType): ToastType {
  if (explicit && explicit !== "default") return explicit;
  if (ERROR_HINTS.test(message)) return "danger";
  if (OK_HINTS.test(message)) return "ok";
  return explicit ?? "default";
}

export function defaultDurationMs(type: ToastType): number {
  switch (type) {
    case "danger":
      return 5200;
    case "warn":
      return 4500;
    case "ok":
      return 3600;
    case "info":
      return 4000;
    default:
      return 3800;
  }
}
