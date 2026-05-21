"use client";

import { OrderStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  ActivityAreaChart,
  CategoryDonut,
  MovementMixBars,
  type SeriesPoint,
} from "@/components/AnalyticsCharts";
import { AppIcon, type AppIconName } from "@/components/icons/AppIcon";
import { ORDER_STATUS_LABELS } from "@/lib/cdc-labels";
import type { CdcKpis } from "@/lib/cdc-kpis-db";
import type { DashboardOverview } from "@/lib/dashboard-db";
import { fetchDashboardFromApi, type DashboardResponse } from "@/lib/stock/api";
import {
  dispo,
  fmt,
  fmtNum,
  fmtTime,
  isArticleStockAlert,
} from "@/lib/stock/helpers";
import type { Evenement, StockState } from "@/lib/stock/types";

import type { PageId } from "@/components/Sidebar";

type DashboardModulePageProps = {
  state: StockState;
  onNavigate: (page: PageId) => void;
  onOpenArticleModal: () => void;
  onOpenEventModal: () => void;
  onOpenAffectModal: (eventId?: string, eventName?: string) => void;
  onOpenSortieModal: () => void;
  onOpenReceptionModal: () => void;
  onOpenRetourModal: () => void;
  onOrderArticle: (articleId: string) => void;
};

const QUICK_LINKS: Array<{ page: PageId; label: string; icon: AppIconName }> = [
  { page: "commandes", label: "Commandes", icon: "orders" },
  { page: "bons", label: "Mouvements", icon: "movements" },
  { page: "rfid", label: "RFID", icon: "rfid" },
  { page: "traceabilite", label: "Traçabilité", icon: "scan" },
  { page: "rh", label: "RH", icon: "team" },
  { page: "validation", label: "Validation", icon: "signature" },
  { page: "alertes", label: "Alertes", icon: "alerts" },
];

const eventStatusClass: Record<string, string> = {
  Prêt: "badge-ok",
  "En préparation": "badge-warn",
  Planifié: "badge-info",
  Terminé: "badge-gray",
  Annulé: "badge-danger",
};

function orderStatusBadge(status: OrderStatus): string {
  if (status === OrderStatus.SETTLED) return "dash-pilot-badge--ok";
  if (status === OrderStatus.IN_PROGRESS) return "dash-pilot-badge--info";
  return "dash-pilot-badge--warn";
}

function dashboardSeries(movements: StockState["mouvements"], days: number): SeriesPoint[] {
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const buckets = new Map(dayKeys.map((k) => [k, { outbound: 0, returns: 0, other: 0, total: 0 }]));
  for (const m of movements) {
    const key = new Date(m.date).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    if (m.type === "Sortie") b.outbound += m.qty;
    else if (m.type === "Retour") b.returns += m.qty;
    else b.other += m.qty;
    b.total += m.qty;
  }
  return dayKeys.map((day) => {
    const b = buckets.get(day)!;
    return { day, ...b };
  });
}

function dashboardMix(movements: StockState["mouvements"]): Record<string, number> {
  const mix: Record<string, number> = { OUTBOUND: 0, RETURN: 0, INBOUND: 0, TRANSFER: 0 };
  for (const m of movements) {
    if (m.type === "Sortie") mix.OUTBOUND += m.qty;
    else if (m.type === "Retour") mix.RETURN += m.qty;
    else if (m.type === "Entrée" || m.type === "Réception") mix.INBOUND += m.qty;
    else if (m.type === "Transfert") mix.TRANSFER += m.qty;
  }
  return mix;
}

function targetMeterClass(actual: number, target: number, higherIsBetter: boolean): string {
  const ok = higherIsBetter ? actual >= target : actual <= target;
  return ok ? "dash-target--ok" : "dash-target--warn";
}

export function DashboardModulePage({
  state,
  onNavigate,
  onOpenArticleModal,
  onOpenEventModal,
  onOpenAffectModal,
  onOpenSortieModal,
  onOpenReceptionModal,
  onOpenRetourModal,
  onOrderArticle,
}: DashboardModulePageProps) {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [dashData, setDashData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [topPeriodDays, setTopPeriodDays] = useState<7 | 14 | 30>(14);

  const load = useCallback(async () => {
    setLoading(true);
    setDashErr(null);
    try {
      const [ovRes, dashRes] = await Promise.all([
        fetch("/api/cdc/dashboard/overview"),
        fetchDashboardFromApi().catch(() => null),
      ]);
      if (ovRes.ok) setOverview((await ovRes.json()) as DashboardOverview);
      setDashData(dashRes);
    } catch {
      setDashErr("Certaines données sont indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = overview?.kpis ?? null;

  const alerts = useMemo(
    () => state.articles.filter((article) => isArticleStockAlert(article)),
    [state.articles],
  );
  const activeEvents = useMemo(
    () => state.evenements.filter((e) => e.statut !== "Terminé" && e.statut !== "Annulé"),
    [state.evenements],
  );
  const affectedCount = state.articles.reduce((sum, a) => sum + a.qtyAff, 0);
  const totalUnits = state.articles.reduce((sum, a) => sum + a.qtyTotal, 0);
  const availableUnits = state.articles.reduce((sum, a) => sum + dispo(a), 0);
  const stockValue = state.articles.reduce((sum, a) => sum + a.qtyTotal * a.valUnit, 0);
  const stockCoverageRate = totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0;
  const allocationRate = totalUnits > 0 ? Math.round((affectedCount / totalUnits) * 100) : 0;
  const heroStockValue = dashData?.metrics?.stockValueEstimate ?? stockValue;
  const nextEvent = [...activeEvents].sort((a, b) => (a.debut || "").localeCompare(b.debut || ""))[0];

  const categoryDistribution = useMemo(
    () =>
      state.articles.reduce<Record<string, number>>((acc, article) => {
        acc[article.cat] = (acc[article.cat] ?? 0) + 1;
        return acc;
      }, {}),
    [state.articles],
  );

  const dashboardPeriodMovements = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (topPeriodDays - 1));
    return state.mouvements.filter((m) => {
      const d = new Date(m.date);
      return !Number.isNaN(d.getTime()) && d >= cutoff;
    });
  }, [state.mouvements, topPeriodDays]);

  const dashActivitySeries = useMemo(() => {
    if (dashData?.movementsSeries14d?.length) {
      return dashData.movementsSeries14d.map((point) => ({
        day: point.day,
        outbound: point.outbound,
        returns: point.returns,
        other: point.other,
        total: point.total,
      }));
    }
    return dashboardSeries(dashboardPeriodMovements, topPeriodDays);
  }, [dashData, dashboardPeriodMovements, topPeriodDays]);

  const dashMovementMix = useMemo(() => {
    if (dashData?.movementByType && Object.keys(dashData.movementByType).length > 0) {
      return {
        OUTBOUND: dashData.movementByType.OUTBOUND ?? 0,
        RETURN: dashData.movementByType.RETURN ?? 0,
        ADJUSTMENT: dashData.movementByType.ADJUSTMENT ?? 0,
      };
    }
    const local = dashboardMix(dashboardPeriodMovements);
    return {
      OUTBOUND: local.OUTBOUND ?? 0,
      RETURN: local.RETURN ?? 0,
      ADJUSTMENT: (local.INBOUND ?? 0) + (local.TRANSFER ?? 0),
    };
  }, [dashData, dashboardPeriodMovements]);

  const dashboardTopArticles = useMemo(() => {
    const byArticle = new Map<string, number>();
    dashboardPeriodMovements.forEach((m) => {
      if (m.type !== "Sortie") return;
      byArticle.set(m.articleId, (byArticle.get(m.articleId) ?? 0) + m.qty);
    });
    return Array.from(byArticle.entries())
      .map(([id, qty]) => ({ id, qty, article: state.articles.find((a) => a.id === id) }))
      .filter((item) => Boolean(item.article))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [dashboardPeriodMovements, state.articles]);
  const dashboardTopMax = Math.max(1, ...dashboardTopArticles.map((i) => i.qty));

  function exportAlertsCsv() {
    const rows = [
      ["Référence", "Désignation", "Disponible", "Seuil min", "Catégorie"],
      ...alerts.map((article) => [
        article.ref,
        article.nom,
        String(dispo(article)),
        String(article.seuilMin),
        article.cat,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alertes-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openDocs =
    kpis != null
      ? kpis.documents.pendingSignature + kpis.documents.disputed + kpis.documents.transfersOver48h
      : 0;

  return (
    <div className="dash-premium">
      <section className="dash-pilot-hero">
        <div className="dash-pilot-hero-grid">
          <div>
            <h1 className="dash-pilot-title">Tableau de bord</h1>
            {nextEvent ? (
              <p className="dash-pilot-next">
                Prochain événement : <strong>{nextEvent.nom}</strong> · {fmt(nextEvent.debut)}
              </p>
            ) : null}
          </div>
          <div className="dash-pilot-hero-side">
            <div className="dash-pilot-stat">
              <span className="dash-pilot-stat-lbl">Valeur stock</span>
              <strong>{fmtNum(heroStockValue)}</strong>
              <span className="dash-pilot-stat-unit">F CFA</span>
            </div>
            <div className="dash-pilot-stat">
              <span className="dash-pilot-stat-lbl">Unités catalogue</span>
              <strong>{fmtNum(totalUnits)}</strong>
            </div>
            <div className="dash-pilot-actions">
              <button
                type="button"
                className="dash-pilot-btn dash-pilot-btn--ghost"
                disabled={loading}
                onClick={() => void load()}
              >
                <AppIcon name="sync" size={14} />
                Actualiser
              </button>
              <button
                type="button"
                className="dash-pilot-btn dash-pilot-btn--ghost"
                onClick={exportAlertsCsv}
              >
                <AppIcon name="fileExport" size={14} />
                Alertes CSV
              </button>
              <button type="button" className="dash-pilot-btn dash-pilot-btn--gold" onClick={onOpenArticleModal}>
                <AppIcon name="plus" size={14} />
                Article
              </button>
            </div>
          </div>
        </div>
      </section>

      {dashErr ? <p className="dash-pilot-err" role="status">{dashErr}</p> : null}

      {!kpis ? (
        <p className="dash-empty" aria-busy={loading}>
          {loading ? "Chargement des indicateurs…" : "Indicateurs indisponibles."}
        </p>
      ) : (
        <>
          <div className="dash-pilot-kpi-row">
            <article className="dash-pilot-kpi">
              <AppIcon name="orders" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.orders.pending}</div>
              <div className="dash-pilot-kpi-lbl">{ORDER_STATUS_LABELS.PENDING}</div>
            </article>
            <article className="dash-pilot-kpi dash-pilot-kpi--info">
              <AppIcon name="orders" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.orders.inProgress}</div>
              <div className="dash-pilot-kpi-lbl">{ORDER_STATUS_LABELS.IN_PROGRESS}</div>
            </article>
            <article className="dash-pilot-kpi dash-pilot-kpi--ok">
              <AppIcon name="orders" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.orders.settled}</div>
              <div className="dash-pilot-kpi-lbl">{ORDER_STATUS_LABELS.SETTLED}</div>
            </article>
            <article className={`dash-pilot-kpi${kpis.documents.pendingSignature > 0 ? " dash-pilot-kpi--warn" : ""}`}>
              <AppIcon name="signature" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.documents.pendingSignature}</div>
              <div className="dash-pilot-kpi-lbl">Bons à signer</div>
            </article>
            <article className={`dash-pilot-kpi${kpis.documents.disputed > 0 ? " dash-pilot-kpi--danger" : ""}`}>
              <AppIcon name="alerts" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.documents.disputed}</div>
              <div className="dash-pilot-kpi-lbl">Litiges RFID</div>
            </article>
            <article className="dash-pilot-kpi dash-pilot-kpi--accent">
              <AppIcon name="rfid" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.rfid.traceabilityPct}%</div>
              <div className="dash-pilot-kpi-lbl">Traçabilité</div>
            </article>
            <article className="dash-pilot-kpi">
              <AppIcon name="team" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.staff.pct}%</div>
              <div className="dash-pilot-kpi-lbl">Effectifs affectés</div>
            </article>
            <article className={`dash-pilot-kpi${kpis.documents.transfersOver48h > 0 ? " dash-pilot-kpi--warn" : ""}`}>
              <AppIcon name="movements" size={16} />
              <div className="dash-pilot-kpi-val">{kpis.documents.transfersOver48h}</div>
              <div className="dash-pilot-kpi-lbl">BT &gt; 48 h</div>
            </article>
          </div>

          <div className="dash-targets">
            <article
              className={`dash-target ${targetMeterClass(kpis.rfid.traceabilityPct, kpis.targets.traceabilityPct, true)}`}
            >
              <div className="dash-target-hd">
                <span>Traçabilité RFID</span>
                <strong>
                  {kpis.rfid.traceabilityPct}% / {kpis.targets.traceabilityPct}%
                </strong>
              </div>
              <div
                className="dash-target-bar"
                style={{ ["--dash-pct" as string]: `${Math.min(100, kpis.rfid.traceabilityPct)}%` } as CSSProperties}
              />
              <p className="dash-target-sub">{kpis.rfid.taggedAssets} tags · {kpis.rfid.catalogQty} unités catalogue</p>
            </article>
            <article
              className={`dash-target ${targetMeterClass(kpis.inventory.accuracyPct, kpis.targets.inventoryAccuracyPct, true)}`}
            >
              <div className="dash-target-hd">
                <span>Fiabilité inventaire</span>
                <strong>
                  {kpis.inventory.accuracyPct}% / {kpis.targets.inventoryAccuracyPct}%
                </strong>
              </div>
              <div
                className="dash-target-bar"
                style={{ ["--dash-pct" as string]: `${kpis.inventory.accuracyPct}%` } as CSSProperties}
              />
              <p className="dash-target-sub">
                {kpis.inventory.quarantineAssets} en quarantaine · {kpis.inventory.mismatchLines} litige(s)
              </p>
            </article>
            <article className="dash-target dash-target--neutral">
              <div className="dash-target-hd">
                <span>Mouvements du jour</span>
              </div>
              <p className="dash-target-moves">
                BE {kpis.documents.todayBe} · BS {kpis.documents.todayBs} · BT {kpis.documents.todayBt}
              </p>
            </article>
          </div>

          {overview && (overview.notifications.urgent > 0 || openDocs > 0) ? (
            <div className="dash-pilot-alerts">
              {overview.notifications.urgent > 0 ? (
                <button type="button" className="dash-pilot-alert dash-pilot-alert--urgent" onClick={() => onNavigate("alertes")}>
                  <AppIcon name="alerts" size={16} />
                  {overview.notifications.urgent} notification(s) urgente(s)
                </button>
              ) : null}
              {openDocs > 0 ? (
                <button type="button" className="dash-pilot-alert" onClick={() => onNavigate("bons")}>
                  <AppIcon name="documents" size={16} />
                  {openDocs} bon(s) à traiter
                </button>
              ) : null}
              {overview.notifications.unread > 0 ? (
                <span className="dash-pilot-alert-meta">{overview.notifications.unread} non lue(s)</span>
              ) : null}
            </div>
          ) : null}

          <div className="dash-quick">
            {QUICK_LINKS.map((link) => (
              <button
                key={link.page}
                type="button"
                className="dash-quick-btn"
                onClick={() => onNavigate(link.page)}
              >
                <AppIcon name={link.icon} size={14} />
                {link.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="dash-pilot-layout">
        <div className="dash-pilot-main">
          <section className="dash-pilot-card">
            <div className="dash-pilot-card-hd">
              <h2>Tendance des mouvements</h2>
              <div className="dash-period" role="group" aria-label="Période">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`dash-period-btn${topPeriodDays === days ? " dash-period-btn--on" : ""}`}
                    onClick={() => setTopPeriodDays(days)}
                  >
                    {days}j
                  </button>
                ))}
              </div>
            </div>
            <ActivityAreaChart series={dashActivitySeries} loading={loading && !dashData} />
          </section>

          <div className="dash-pilot-charts-2">
            <section className="dash-pilot-card">
              <h2>Répartition catalogue</h2>
              <CategoryDonut distribution={categoryDistribution} />
            </section>
            <section className="dash-pilot-card">
              <h2>Mix mouvements</h2>
              <MovementMixBars mix={dashMovementMix} loading={loading && !dashData} />
            </section>
          </div>

          <section className="dash-pilot-card">
            <div className="dash-pilot-card-hd">
              <h2>Top sorties ({topPeriodDays} j)</h2>
            </div>
            {dashboardTopArticles.length === 0 ? (
              <p className="dash-empty">Aucune sortie sur la période.</p>
            ) : (
              <div className="dash-top-list">
                {dashboardTopArticles.map((item, index) => (
                  <div key={item.id} className="dash-top-row">
                    <span className="dash-top-rank">{index + 1}</span>
                    <div className="dash-top-main">
                      <div className="dash-top-name">{item.article?.nom}</div>
                      <div
                        className="dash-top-bar"
                        style={{ ["--dash-top-pct" as string]: `${(item.qty / dashboardTopMax) * 100}%` } as CSSProperties}
                      />
                    </div>
                    <span className="dash-top-val">{fmtNum(item.qty)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="dash-pilot-aside">
          {kpis?.sites.warehouses.length ? (
            <section className="dash-pilot-card">
              <h2>Sites & entrepôts</h2>
              <div className="dash-sites">
                {kpis.sites.warehouses.map((w) => (
                  <span key={w.id} className="dash-site-badge">
                    {w.name} · {w.assetCount} RFID
                  </span>
                ))}
                <span className="dash-site-badge dash-site-badge--info">
                  {kpis.sites.activeEventSites} chantier(s)
                </span>
              </div>
            </section>
          ) : null}

          {overview?.upcomingOrders.length ? (
            <section className="dash-pilot-card">
              <div className="dash-pilot-card-hd">
                <h2>Commandes à venir</h2>
                <button type="button" className="dash-link" onClick={() => onNavigate("commandes")}>
                  Tout voir
                </button>
              </div>
              <ul className="dash-order-list">
                {overview.upcomingOrders.map((ev) => (
                  <li key={ev.id}>
                    <div className="dash-order-name">{ev.name}</div>
                    <div className="dash-order-meta">
                      {ev.clientName} · {new Date(ev.startsAt).toLocaleDateString("fr-FR")}
                    </div>
                    <span className={`dash-pilot-badge ${orderStatusBadge(ev.orderStatus)}`}>
                      {ev.orderStatusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="dash-pilot-card">
            <div className="dash-pilot-card-hd">
              <h2>Alertes stock</h2>
              <button type="button" className="dash-link" onClick={() => onNavigate("alertes")}>
                Tout voir
              </button>
            </div>
            {alerts.length === 0 ? (
              <p className="dash-empty">Aucune alerte catalogue.</p>
            ) : (
              <ul className="dash-stock-alerts">
                {alerts.slice(0, 5).map((article) => (
                  <li key={article.id}>
                    <span>{article.emoji || "📦"}</span>
                    <div>
                      <strong>{article.nom}</strong>
                      <span>
                        {dispo(article)} dispo. · min {article.stockLevels?.min ?? article.seuilMin}
                      </span>
                    </div>
                    <button type="button" className="btn btn-xs btn-outline" onClick={() => onOrderArticle(article.id)}>
                      Commander
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-pilot-card">
            <h2>Événements actifs</h2>
            {activeEvents.length === 0 ? (
              <p className="dash-empty">Aucun événement actif.</p>
            ) : (
              <ul className="dash-ev-list">
                {activeEvents.slice(0, 5).map((ev: Evenement) => (
                  <li key={ev.id}>
                    <strong>{ev.nom}</strong>
                    <span>
                      {fmt(ev.debut)} · {ev.lieu || "—"}
                    </span>
                    <span className={`badge ${eventStatusClass[ev.statut] ?? "badge-gray"}`}>{ev.statut}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={() => onNavigate("evenements")}>
              Calendrier
            </button>
          </section>

          <section className="dash-pilot-card">
            <h2>Actions rapides</h2>
            <div className="dash-action-grid">
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpenSortieModal}>
                Sortie
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpenReceptionModal}>
                Entrée
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpenRetourModal}>
                Retour
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpenAffectModal()}>
                Affecter
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpenEventModal}>
                Événement
              </button>
              <button type="button" className="btn btn-gold btn-sm" onClick={() => onNavigate("alertes")}>
                Alertes
              </button>
            </div>
            <p className="dash-insight-mini">
              Couverture {stockCoverageRate}% · Affectation {allocationRate}%
            </p>
          </section>

          <section className="dash-pilot-card">
            <div className="dash-pilot-card-hd">
              <h2>Activité récente</h2>
              <button type="button" className="dash-link" onClick={() => onNavigate("mouvements")}>
                Journal
              </button>
            </div>
            <ul className="dash-tl">
              {state.mouvements.slice(0, 6).map((movement) => {
                const article = state.articles.find((a) => a.id === movement.articleId);
                return (
                  <li key={movement.id}>
                    <span className="dash-tl-dot" />
                    <div>
                      <strong>
                        {movement.type} · {article?.nom ?? "Article"}
                      </strong>
                      <span>
                        {movement.qty} u. · {fmtTime(movement.date)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
