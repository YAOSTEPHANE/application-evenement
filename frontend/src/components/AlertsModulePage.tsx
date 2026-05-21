"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import type { PageId } from "@/components/Sidebar";
import {
  resolveNotificationNav,
  severityBadgeClass,
  type NotificationRow,
} from "@/lib/notification-navigation";
import { clientFetch } from "@/lib/stock/api";
import { dispo, fmtNum } from "@/lib/stock/helpers";
import type { Article } from "@/lib/stock/types";

type TabId = "metier" | "stock";
type SeverityFilter = "all" | "URGENT" | "WARNING" | "INFO";

type AlertsModulePageProps = {
  stockAlerts: Article[];
  onRefreshStock: () => void;
  onEditArticle: (articleId: string) => void;
  onOrderArticle: (articleId: string) => void;
  onNavigate?: (page: PageId) => void;
  onCountsChange?: (counts: { urgent: number; warning: number; unread: number }) => void;
};

export function AlertsModulePage({
  stockAlerts,
  onRefreshStock,
  onEditArticle,
  onOrderArticle,
  onNavigate,
  onCountsChange,
}: AlertsModulePageProps) {
  const [tab, setTab] = useState<TabId>("metier");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [counts, setCounts] = useState({ urgent: 0, warning: 0, unread: 0 });
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const q = unreadOnly ? "?unread=1" : "";
      const res = await clientFetch(`/api/notifications${q}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: NotificationRow[];
        counts?: { urgent: number; warning: number; unread: number };
      };
      const nextItems = data.items ?? [];
      const nextCounts = data.counts ?? { urgent: 0, warning: 0, unread: 0 };
      setItems(nextItems);
      setCounts(nextCounts);
      onCountsChange?.(nextCounts);
    } finally {
      setLoading(false);
    }
  }, [onCountsChange, unreadOnly]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredItems = useMemo(() => {
    if (severityFilter === "all") return items;
    return items.filter((n) => (n.severity ?? "INFO") === severityFilter);
  }, [items, severityFilter]);

  async function markRead(id: string) {
    await clientFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadNotifications();
  }

  async function markAllRead() {
    await clientFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await loadNotifications();
  }

  function openNotification(n: NotificationRow) {
    void (async () => {
      if (!n.readAt) {
        await markRead(n.id);
      }
      const target = resolveNotificationNav(n);
      onNavigate?.(target.page);
    })();
  }

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Alertes &amp; notifications</div>
          <div className="ph-sub">
            Notifications métier (retours, signatures, transferts) et seuils de stock catalogue
          </div>
        </div>
        <div className="ph-actions">
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => {
              if (tab === "metier") void loadNotifications();
              else onRefreshStock();
            }}
          >
            ↻ Actualiser
          </button>
          {tab === "metier" && counts.unread > 0 ? (
            <button className="btn btn-outline btn-sm" type="button" onClick={() => void markAllRead()}>
              Tout marquer lu
            </button>
          ) : null}
        </div>
      </div>

      <div className="alerts-tabs" role="tablist" aria-label="Type d'alertes">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "metier"}
          className={`alerts-tab${tab === "metier" ? " alerts-tab--on" : ""}`}
          onClick={() => setTab("metier")}
        >
          Métier
          {counts.unread > 0 ? (
            <span className="badge badge-danger alerts-tab-badge">{counts.unread}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stock"}
          className={`alerts-tab${tab === "stock" ? " alerts-tab--on" : ""}`}
          onClick={() => setTab("stock")}
        >
          Stock catalogue
          {stockAlerts.length > 0 ? (
            <span className="badge badge-warn alerts-tab-badge">{stockAlerts.length}</span>
          ) : null}
        </button>
      </div>

      {tab === "metier" ? (
        <div className="card card-pad" role="tabpanel">
          <div className="cdc-notif-summary">
            <span className="badge badge-danger">Urgent {counts.urgent}</span>
            <span className="badge badge-warn">Avert. {counts.warning}</span>
            <span className="badge badge-info">Non lues {counts.unread}</span>
          </div>

          <div className="alerts-filters">
            <label className="alerts-filter-check">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Non lues uniquement
            </label>
            <select
              className="inp alerts-filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              aria-label="Filtrer par gravité"
            >
              <option value="all">Toutes gravités</option>
              <option value="URGENT">Urgent</option>
              <option value="WARNING">Avertissement</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {loading ? <p className="fs12 text-muted">Chargement…</p> : null}
          {filteredItems.map((n) => (
            <div
              key={n.id}
              className={`cdc-notif-item${n.readAt ? " cdc-notif-item--read" : ""}${n.severity === "URGENT" ? " cdc-notif-item--urgent" : ""}`}
              onClick={() => openNotification(n)}
              onKeyDown={(e) => e.key === "Enter" && openNotification(n)}
              role="button"
              tabIndex={0}
            >
              <div className="cdc-notif-item-hd">
                <AppIcon name="alerts" size={16} />
                <div className="fw500">{n.title}</div>
                <span className={`badge ${severityBadgeClass(n.severity)}`}>
                  {n.severity === "URGENT" ? "Urgent" : n.severity === "WARNING" ? "Avert." : "Info"}
                </span>
              </div>
              <div className="fs12">{n.body}</div>
              <div className="cdc-notif-item-ft">
                <span className="fs11 text-muted">{new Date(n.createdAt).toLocaleString("fr-FR")}</span>
                {onNavigate ? (
                  <span className="fs11 fc-gold">Ouvrir → {resolveNotificationNav(n).label}</span>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>Aucune notification métier</h3>
              <p>
                Les alertes (retour J+1, signatures en attente, transferts bloqués) apparaissent ici
                lorsque le cycle CDC est exécuté côté serveur.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div id="alertes-list" role="tabpanel">
          {stockAlerts.map((article) => (
            <div
              key={article.id}
              className={`card card-pad mb12 alert-card ${dispo(article) === 0 ? "alert-card-danger" : "alert-card-warn"}`}
            >
              <div className="alert-card-layout">
                <div className="alert-card-main">
                  <div className="item-thumb item-thumb-lg">{article.emoji || "📦"}</div>
                  <div>
                    <div className={`alert-card-title ${dispo(article) === 0 ? "fc-danger" : "fc-warn"}`}>
                      {dispo(article) === 0 ? "Rupture de stock" : "Stock critique"} — {article.nom}
                    </div>
                    <div className="fs12 fc-3 mt3">
                      {dispo(article)} unité(s) disponible(s) · Seuil min: {article.seuilMin} · Réf:{" "}
                      {article.ref || "N/A"} · Catégorie: {article.cat}
                    </div>
                    <div className="fs12 fc-3">
                      Valeur unitaire: {fmtNum(article.valUnit)} F CFA · Qté totale: {article.qtyTotal}
                    </div>
                  </div>
                </div>
                <div className="alert-card-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={() => onEditArticle(article.id)}
                  >
                    Modifier seuil
                  </button>
                  <button
                    className="btn btn-sm btn-gold"
                    type="button"
                    onClick={() => onOrderArticle(article.id)}
                  >
                    Commander
                  </button>
                </div>
              </div>
            </div>
          ))}
          {stockAlerts.length === 0 ? (
            <div id="alertes-empty" className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>Aucune alerte stock</h3>
              <p>Tous les stocks sont au-dessus du seuil minimum.</p>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
