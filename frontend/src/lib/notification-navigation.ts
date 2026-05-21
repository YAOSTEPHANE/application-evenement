import { stashCdcBonsFlow } from "@/lib/cdc-bons-navigation";

import type { PageId } from "@/components/Sidebar";

export type NotificationRow = {
  id: string;
  module: string;
  title: string;
  body: string;
  targetType?: string | null;
  targetId?: string | null;
  severity?: string;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationNavTarget = {
  page: PageId;
  label: string;
};

/** Résout la page CDC / legacy à ouvrir depuis une notification in-app. */
export function resolveNotificationNav(n: NotificationRow): NotificationNavTarget {
  const targetId = n.targetId?.trim();
  const module = n.module.toLowerCase();

  if (n.targetType === "StockDocument" && targetId) {
    stashCdcBonsFlow({ openDocumentId: targetId });
    return { page: "bons", label: "Bon concerné" };
  }

  if (n.targetType === "Event" && targetId) {
    if (module === "commandes" || n.title.toLowerCase().includes("bs-evt")) {
      return { page: "commandes", label: "Commande" };
    }
    return { page: "traceabilite", label: "Traçabilité commande" };
  }

  if (module === "mouvements") return { page: "bons", label: "Mouvements" };
  if (module === "commandes") return { page: "commandes", label: "Commandes" };
  if (module === "alertes") return { page: "alertes", label: "Alertes" };
  if (module === "rh") return { page: "rh", label: "Ressources humaines" };
  if (module === "validation") return { page: "validation", label: "Validation" };

  return { page: "alertes", label: "Notifications" };
}

export function severityBadgeClass(severity?: string): string {
  if (severity === "URGENT") return "badge-danger";
  if (severity === "WARNING") return "badge-warn";
  return "badge-info";
}
