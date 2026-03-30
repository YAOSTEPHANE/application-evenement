"use client";

import { useMemo } from "react";

import {
  ActivityAreaChart,
  CategoryDeepDive,
  DailyVolumeBars,
  MovementMixBars,
  type SeriesPoint,
} from "@/components/AnalyticsCharts";
import type { AuditLogsResponse, DashboardResponse } from "@/lib/stock/api";
import { dispo, fmt, fmtNum, fmtTime } from "@/lib/stock/helpers";
import type { Article, Evenement, StockState } from "@/lib/stock/types";

import type { PageId } from "./Sidebar";

export type AnalyticsReportStats = {
  totalSorties: number;
  totalRetours: number;
  totalPertes: number;
  topArticles: Array<{ id: string; qty: number; article?: Article }>;
  categoryDistribution: Record<string, number>;
};

function localSeries14(state: StockState): SeriesPoint[] {
  const dayKeys: string[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const map = new Map(dayKeys.map((day) => [day, { outbound: 0, returns: 0, other: 0 }]));
  for (const m of state.mouvements) {
    const key = m.date.slice(0, 10);
    const b = map.get(key);
    if (!b) {
      continue;
    }
    if (m.type === "Sortie") {
      b.outbound += m.qty;
    } else if (m.type === "Retour") {
      b.returns += m.qty;
    } else {
      b.other += m.qty;
    }
  }
  return dayKeys.map((day) => {
    const b = map.get(day)!;
    return { day, ...b, total: b.outbound + b.returns + b.other };
  });
}

function localMovementMix(state: StockState): Record<string, number> {
  const acc: Record<string, number> = { OUTBOUND: 0, RETURN: 0, ADJUSTMENT: 0 };
  for (const m of state.mouvements) {
    if (m.type === "Sortie") {
      acc.OUTBOUND += m.qty;
    } else if (m.type === "Retour") {
      acc.RETURN += m.qty;
    } else {
      acc.ADJUSTMENT += m.qty;
    }
  }
  return acc;
}

function localAllocationRate(state: StockState): number {
  const sumTot = state.articles.reduce((s, a) => s + a.qtyTotal, 0);
  const sumAff = state.articles.reduce((s, a) => s + a.qtyAff, 0);
  return sumTot > 0 ? Math.round((sumAff / sumTot) * 1000) / 10 : 0;
}

type AnalyticsRapportsProps = {
  dashboard: DashboardResponse | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  reportStats: AnalyticsReportStats;
  stockValue: number;
  state: StockState;
  eventStatusClass: Record<string, string>;
  onNavigate: (page: PageId) => void;
  onPrintReport: () => void;
  auditLogs: AuditLogsResponse["logs"];
  auditLoading: boolean;
  auditError: string | null;
  auditHasMore: boolean;
  auditSkip: number;
  loadAuditLogs: (opts: { skip: number; replace: boolean }) => void;
};

export function AnalyticsRapports({
  dashboard,
  dashboardLoading,
  dashboardError,
  reportStats,
  stockValue,
  state,
  eventStatusClass,
  onNavigate,
  onPrintReport,
  auditLogs,
  auditLoading,
  auditError,
  auditHasMore,
  auditSkip,
  loadAuditLogs,
}: AnalyticsRapportsProps) {
  const series = useMemo(() => {
    if (dashboard?.movementsSeries14d?.length) {
      return dashboard.movementsSeries14d;
    }
    return localSeries14(state);
  }, [dashboard, state]);

  const mix = useMemo(() => {
    if (dashboard?.movementByType && Object.keys(dashboard.movementByType).length > 0) {
      return {
        OUTBOUND: dashboard.movementByType.OUTBOUND ?? 0,
        RETURN: dashboard.movementByType.RETURN ?? 0,
        ADJUSTMENT: dashboard.movementByType.ADJUSTMENT ?? 0,
      };
    }
    return localMovementMix(state);
  }, [dashboard, state]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; value: number; qtyUnits: number }>();
    for (const article of state.articles) {
      const key = article.cat?.trim() || "Autre";
      const cur = map.get(key) ?? { count: 0, value: 0, qtyUnits: 0 };
      cur.count += 1;
      cur.value += article.qtyTotal * article.valUnit;
      cur.qtyUnits += article.qtyTotal;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [state.articles]);

  const m = dashboard?.metrics;
  const itemCount = m?.items ?? state.articles.length;
  const activeEv = m?.activeEvents ?? state.evenements.filter((e) => e.statut !== "Terminé" && e.statut !== "Annulé").length;
  const movementsTotal = m?.movements ?? state.mouvements.length;
  const alertsN = m?.alerts ?? state.articles.filter((a) => dispo(a) <= a.seuilMin).length;
  const allocPct = m?.allocationRatePct ?? localAllocationRate(state);
  const valeur = m?.stockValueEstimate != null && m.stockValueEstimate > 0 ? m.stockValueEstimate : stockValue;

  return (
    <>
      <header className="an-hero">
        <div className="an-hero-grid" aria-hidden />
        <div className="an-hero-inner">
          <div className="an-hero-copy">
            <p className="an-eyebrow">Insights &amp; performance</p>
            <h1 className="an-hero-title">Centre analytique</h1>
            <p className="an-hero-desc">
              Vue consolidée des flux, du stock et de l&apos;activité opérationnelle — données synchronisées avec votre
              organisation.
            </p>
            <div className="an-hero-tags">
              <span className="an-tag">14 jours</span>
              <span className="an-tag">Temps réel</span>
              {dashboardError ? <span className="an-tag an-tag-warn">Mode hors ligne</span> : null}
            </div>
          </div>
          <div className="an-hero-panel">
            <div className="an-hero-stat">
              <span className="an-hero-stat-label">Sorties cumulées</span>
              <span className="an-hero-stat-num">{fmtNum(reportStats.totalSorties)}</span>
              <span className="an-hero-stat-sub">unités enregistrées</span>
            </div>
            <div className="an-hero-stat an-hero-stat-alt">
              <span className="an-hero-stat-label">Taux d&apos;affectation</span>
              <span className="an-hero-stat-num">{allocPct}%</span>
              <span className="an-hero-stat-sub">du parc mobilisé</span>
            </div>
          </div>
        </div>
      </header>

      <div className="an-kpi-bento">
        <article className="an-kpi an-kpi-wide an-kpi-navy">
          <span className="an-kpi-label">Références catalogue</span>
          <strong className="an-kpi-value">{fmtNum(itemCount)}</strong>
          <span className="an-kpi-hint">articles suivis</span>
        </article>
        <article className="an-kpi an-kpi-gold">
          <span className="an-kpi-label">Événements actifs</span>
          <strong className="an-kpi-value">{fmtNum(activeEv)}</strong>
          <span className="an-kpi-hint">sur {fmtNum(state.evenements.length)} au total</span>
        </article>
        <article className="an-kpi an-kpi-ok">
          <span className="an-kpi-label">Mouvements</span>
          <strong className="an-kpi-value">{fmtNum(movementsTotal)}</strong>
          <span className="an-kpi-hint">lignes historisées</span>
        </article>
        <article className="an-kpi an-kpi-warn">
          <span className="an-kpi-label">Alertes stock</span>
          <strong className="an-kpi-value">{fmtNum(alertsN)}</strong>
          <span className="an-kpi-hint">
            <button type="button" className="an-kpi-link" onClick={() => onNavigate("alertes")}>
              Gérer →
            </button>
          </span>
        </article>
        <article className="an-kpi an-kpi-surface">
          <span className="an-kpi-label">Valeur estimée</span>
          <strong className="an-kpi-value">{fmtNum(Math.round(valeur))}</strong>
          <span className="an-kpi-hint">F CFA</span>
        </article>
        <article className="an-kpi an-kpi-info">
          <span className="an-kpi-label">Pertes / dommages</span>
          <strong className="an-kpi-value">{fmtNum(reportStats.totalPertes)}</strong>
          <span className="an-kpi-hint">unités signalées</span>
        </article>
      </div>

      <div className="an-toolbar">
        <div className="an-toolbar-left">
          <h2 className="an-section-title">Tendances &amp; répartition</h2>
          <p className="an-section-sub">Volumes des 14 derniers jours et mix des flux</p>
        </div>
        <div className="an-toolbar-actions">
          <button className="btn btn-outline btn-sm" type="button" onClick={onPrintReport}>
            ↓ Exporter / Imprimer
          </button>
        </div>
      </div>

      <div className="an-grid-charts">
        <section className="card card-pad an-card-glass">
          <div className="card-title an-card-head">
            <h3>Activité des mouvements</h3>
            <span className="an-card-badge">14 jours</span>
          </div>
          <ActivityAreaChart series={series} loading={dashboardLoading && !dashboard} />
          <DailyVolumeBars series={series} loading={dashboardLoading && !dashboard} />
        </section>
        <section className="card card-pad an-card-glass">
          <div className="card-title an-card-head">
            <h3>Mix des flux (quantités)</h3>
          </div>
          <MovementMixBars mix={mix} loading={dashboardLoading && !dashboard} />
        </section>
      </div>

      <div className="an-grid-split">
        <section className="card card-pad an-card-glass">
          <div className="card-title an-card-head">
            <h3>Articles les plus sollicités</h3>
          </div>
          <div className="an-top-list">
            {reportStats.topArticles.length === 0 ? (
              <div className="fs12 fc-3">Aucune sortie enregistrée</div>
            ) : (
              reportStats.topArticles.map((item, index) => (
                <div key={item.id} className="an-top-row">
                  <span className="an-top-rank">{index + 1}</span>
                  <span className="an-top-ico">{item.article?.emoji || "📦"}</span>
                  <div className="an-top-body">
                    <div className="an-top-name">{item.article?.nom}</div>
                    <progress
                      className="progress-meter progress-meter-info an-top-bar"
                      value={item.qty}
                      max={Math.max(1, reportStats.topArticles[0]?.qty ?? 1)}
                    />
                  </div>
                  <span className="an-top-qty">{fmtNum(item.qty)}</span>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="card card-pad an-card-glass">
          <div className="card-title an-card-head">
            <h3>Catégories — stock &amp; valeur</h3>
            <span className="an-card-badge">Top 10</span>
          </div>
          <CategoryDeepDive rows={categoryBreakdown} onManageCategories={() => onNavigate("categories")} />
        </section>
      </div>

      <section className="card card-pad mt14 an-card-glass">
        <div className="card-title an-card-head">
          <h3>Historique des événements</h3>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Événement</th>
                <th>Client</th>
                <th>Date</th>
                <th>Articles sortis</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {state.evenements.map((event: Evenement) => (
                <tr key={event.id}>
                  <td>{event.nom}</td>
                  <td>{event.client || "—"}</td>
                  <td>{event.debut ? fmt(event.debut) : "—"}</td>
                  <td>
                    {fmtNum(
                      state.mouvements
                        .filter((movement) => movement.evId === event.id && movement.type === "Sortie")
                        .reduce((sum, movement) => sum + movement.qty, 0),
                    )}
                  </td>
                  <td>
                    <span className={`badge ${eventStatusClass[event.statut] ?? "badge-gray"}`}>{event.statut}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad mt14 an-card-glass">
        <div className="card-title an-card-head">
          <h3>Journal d&apos;activité</h3>
        </div>
        <div className="ph-actions">
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => void loadAuditLogs({ skip: 0, replace: true })}
            disabled={auditLoading}
          >
            ↻ Rafraîchir
          </button>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => void loadAuditLogs({ skip: auditSkip, replace: false })}
            disabled={auditLoading || !auditHasMore}
          >
            + Charger plus
          </button>
        </div>

        {auditLoading ? (
          <div className="fs12 fc-3 mt3">Chargement…</div>
        ) : auditError ? (
          <div className="auth-error" role="alert">
            {auditError}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◬</div>
            <h3>Aucune entrée</h3>
            <p>Le journal d&apos;activité apparaîtra ici.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Acteur</th>
                  <th>Action</th>
                  <th>Cible</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="fs12">{fmtTime(log.createdAt)}</td>
                    <td>
                      <div className="fw500">{log.actor?.fullName ?? "—"}</div>
                      <div className="fs11 fc-3">{log.actor?.email ?? ""}</div>
                    </td>
                    <td>{log.action}</td>
                    <td className="fs12 fc-3">
                      {log.targetType}:{log.targetId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
