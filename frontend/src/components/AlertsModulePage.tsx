"use client";

import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import { clientFetch } from "@/lib/stock/api";
import { dispo, fmtNum } from "@/lib/stock/helpers";
import type { Article } from "@/lib/stock/types";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  severity?: string;
};

type TabId = "metier" | "stock";

type AlertsModulePageProps = {
  stockAlerts: Article[];
  onRefreshStock: () => void;
  onEditArticle: (articleId: string) => void;
  onOrderArticle: (articleId: string) => void;
};

export function AlertsModulePage({
  stockAlerts,
  onRefreshStock,
  onEditArticle,
  onOrderArticle,
}: AlertsModulePageProps) {
  const [tab, setTab] = useState<TabId>("metier");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [counts, setCounts] = useState({ urgent: 0, warning: 0, unread: 0 });
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientFetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: NotificationRow[];
        counts?: { urgent: number; warning: number; unread: number };
      };
      setItems(data.items ?? []);
      setCounts(data.counts ?? { urgent: 0, warning: 0, unread: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markRead(id: string) {
    await clientFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadNotifications();
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
          {loading ? <p className="fs12 text-muted">Chargement…</p> : null}
          {items.map((n) => (
            <div
              key={n.id}
              className={`cdc-notif-item${n.readAt ? " cdc-notif-item--read" : ""}`}
              onClick={() => void markRead(n.id)}
              onKeyDown={(e) => e.key === "Enter" && void markRead(n.id)}
              role="button"
              tabIndex={0}
            >
              <div className="cdc-notif-item-hd">
                <AppIcon name="alerts" size={16} />
                <div className="fw500">{n.title}</div>
              </div>
              <div className="fs12">{n.body}</div>
              <div className="fs11 text-muted">{new Date(n.createdAt).toLocaleString("fr-FR")}</div>
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>Aucune notification métier</h3>
              <p>
                Les alertes planifiées (retour J+1, signatures en attente, transferts bloqués) apparaissent
                ici lorsque le cycle CDC est exécuté (planification serveur).
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
