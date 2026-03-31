"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnalyticsRapports } from "@/components/AnalyticsRapports";
import {
  ActivityAreaChart,
  CategoryDonut,
  MovementMixBars,
  type SeriesPoint,
} from "@/components/AnalyticsCharts";
import {
  fetchAuditLogsFromApi,
  fetchCategoriesWithCounts,
  fetchDashboardFromApi,
  type CategoryWithCount,
  type DashboardResponse,
} from "@/lib/stock/api";
import { dispo, fmt, fmtNum, fmtTime } from "@/lib/stock/helpers";
import type { Evenement, StockState } from "@/lib/stock/types";
import type { AuditLogsResponse } from "@/lib/stock/api";

import type { PageId } from "./Sidebar";

type MainContentProps = {
  activePage: PageId;
  state: StockState;
  onNavigate: (page: PageId) => void;
  onOpenArticleModal: () => void;
  onOpenEventModal: () => void;
  onOpenAffectModal: () => void;
  onOpenSortieModal: () => void;
  onOpenRetourModal: () => void;
  onOpenUserModal: () => void;
  /** Réservé aux administrateurs : création / édition / suppression d’utilisateurs. */
  canManageUsers: boolean;
  /** Hors « Lecture seule » : CRUD catégories. */
  canManageCategories: boolean;
  categoriesReloadToken: number;
  onOpenCategoryModal: (mode: "create" | "edit", row?: CategoryWithCount) => void;
  onRequestDeleteCategory: (row: CategoryWithCount) => void;
  onDeleteArticle: (articleId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteUser: (userId: string) => void;
  onEditArticle: (articleId: string) => void;
  onEditEvent: (eventId: string) => void;
  onEditUser: (userId: string) => void;
  onScanSortie: (payload: { ref: string; qty: number; eventId: string }) => void;
  onScanRetour: (payload: { ref: string; qty: number; eventId: string }) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onImportCsv: (file: File) => void;
  onRefreshAlerts: () => void;
  onOrderArticle: (articleId: string) => void;
  onGeneratePackingList: (eventId: string) => void;
  onPrintReport: () => void;
  onSaveProfile: (payload: {
    prenom: string;
    nom: string;
    email: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }) => void;
};

const pageClass = (activePage: PageId, page: PageId) =>
  `page${activePage === page ? " active" : ""}`;

const eventStatusClass: Record<string, string> = {
  Prêt: "badge-ok",
  "En préparation": "badge-warn",
  Planifié: "badge-info",
  Terminé: "badge-gray",
  Annulé: "badge-danger",
};

const movementBadgeClass: Record<string, string> = {
  Sortie: "badge-danger",
  Retour: "badge-info",
  Réception: "badge-ok",
  Perte: "badge-danger",
};

const etatBadgeClass = (etat: string) => {
  if (etat === "Bon état") return "badge-ok";
  if (etat === "Perdu" || etat === "Endommagé") return "badge-danger";
  if (etat === "À réparer") return "badge-warn";
  return "badge-gray";
};

const roleBadgeClass: Record<string, string> = {
  Administrateur: "badge-danger",
  Gestionnaire: "badge-warn",
  Magasinier: "badge-info",
  "Lecture seule": "badge-gray",
};

const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

function dashboardSeries(movements: StockState["mouvements"], days: number): SeriesPoint[] {
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const map = new Map(dayKeys.map((day) => [day, { outbound: 0, returns: 0, other: 0 }]));
  for (const movement of movements) {
    const key = movement.date.slice(0, 10);
    const bucket = map.get(key);
    if (!bucket) {
      continue;
    }
    if (movement.type === "Sortie") {
      bucket.outbound += movement.qty;
    } else if (movement.type === "Retour") {
      bucket.returns += movement.qty;
    } else {
      bucket.other += movement.qty;
    }
  }
  return dayKeys.map((day) => {
    const bucket = map.get(day)!;
    return { day, ...bucket, total: bucket.outbound + bucket.returns + bucket.other };
  });
}

function dashboardMix(movements: StockState["mouvements"]): Record<string, number> {
  const mix: Record<string, number> = { OUTBOUND: 0, RETURN: 0, ADJUSTMENT: 0 };
  for (const movement of movements) {
    if (movement.type === "Sortie") {
      mix.OUTBOUND += movement.qty;
    } else if (movement.type === "Retour") {
      mix.RETURN += movement.qty;
    } else {
      mix.ADJUSTMENT += movement.qty;
    }
  }
  return mix;
}

export function MainContent({
  activePage,
  state,
  onNavigate,
  onOpenArticleModal,
  onOpenEventModal,
  onOpenAffectModal,
  onOpenSortieModal,
  onOpenRetourModal,
  onOpenUserModal,
  canManageUsers,
  canManageCategories,
  categoriesReloadToken,
  onOpenCategoryModal,
  onRequestDeleteCategory,
  onDeleteArticle,
  onDeleteEvent,
  onDeleteUser,
  onEditArticle,
  onEditEvent,
  onEditUser,
  onScanSortie,
  onScanRetour,
  soundEnabled,
  onToggleSound,
  onImportCsv,
  onRefreshAlerts,
  onOrderArticle,
  onGeneratePackingList,
  onPrintReport,
  onSaveProfile,
}: MainContentProps) {
  const [scanRef, setScanRef] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [scanEventId, setScanEventId] = useState("");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueFilter, setCatalogueFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [topPeriodDays, setTopPeriodDays] = useState<7 | 14 | 30>(14);
  const [profileAvatarDataUrl, setProfileAvatarDataUrl] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(state.calYear, state.calMonth, 1));

  const AUDIT_TAKE = 10;
  const [auditLogs, setAuditLogs] = useState<AuditLogsResponse["logs"]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSkip, setAuditSkip] = useState(0);
  const [auditTotal, setAuditTotal] = useState<number | null>(null);
  const [dashData, setDashData] = useState<DashboardResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<CategoryWithCount[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const auditHasMore = auditTotal != null && auditLogs.length < auditTotal;

  const loadAuditLogs = useCallback(
    async (opts: { skip: number; replace: boolean }) => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const resp = await fetchAuditLogsFromApi({ take: AUDIT_TAKE, skip: opts.skip });
        setAuditTotal(resp.total);
        setAuditSkip(opts.skip + resp.take);
        setAuditLogs((prev) => (opts.replace ? resp.logs : [...prev, ...resp.logs]));
      } catch (err) {
        setAuditError(err instanceof Error ? err.message : "Impossible de charger le journal");
      } finally {
        setAuditLoading(false);
      }
    },
    [AUDIT_TAKE],
  );

  useEffect(() => {
    if (activePage !== "rapports") {
      return;
    }
    void loadAuditLogs({ skip: 0, replace: true });
  }, [activePage, loadAuditLogs]);

  useEffect(() => {
    if (activePage !== "rapports") {
      return;
    }
    let cancel = false;
    setDashLoading(true);
    setDashErr(null);
    void fetchDashboardFromApi()
      .then((d) => {
        if (!cancel) {
          setDashData(d);
        }
      })
      .catch((e) => {
        if (!cancel) {
          setDashErr(e instanceof Error ? e.message : "Données analytiques indisponibles");
          setDashData(null);
        }
      })
      .finally(() => {
        if (!cancel) {
          setDashLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [activePage]);

  useEffect(() => {
    if (activePage !== "categories") {
      return;
    }
    let cancel = false;
    setCategoryLoading(true);
    setCategoryError(null);
    void fetchCategoriesWithCounts()
      .then((rows) => {
        if (!cancel) {
          setCategoryRows(rows);
        }
      })
      .catch((e) => {
        if (!cancel) {
          setCategoryError(e instanceof Error ? e.message : "Impossible de charger les catégories");
          setCategoryRows([]);
        }
      })
      .finally(() => {
        if (!cancel) {
          setCategoryLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [activePage, categoriesReloadToken]);

  const activeEvents = state.evenements.filter((event) => event.statut !== "Terminé" && event.statut !== "Annulé");
  const alerts = state.articles.filter((article) => dispo(article) <= article.seuilMin);
  const affectedCount = state.articles.reduce((sum, article) => sum + article.qtyAff, 0);
  const stockValue = state.articles.reduce((sum, article) => sum + article.qtyTotal * article.valUnit, 0);
  const totalUnits = state.articles.reduce((sum, article) => sum + article.qtyTotal, 0);
  const availableUnits = state.articles.reduce((sum, article) => sum + dispo(article), 0);
  const stockCoverageRate = totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0;
  const allocationRate = totalUnits > 0 ? Math.round((affectedCount / totalUnits) * 100) : 0;
  const criticalStockValue = state.articles
    .filter((article) => dispo(article) <= article.seuilMin)
    .reduce((sum, article) => sum + article.valUnit * Math.max(0, dispo(article)), 0);
  const nextEvent = [...activeEvents].sort((a, b) => (a.debut || "").localeCompare(b.debut || ""))[0];
  const nextEventItemsOut = nextEvent
    ? state.mouvements
        .filter((movement) => movement.evId === nextEvent.id && movement.type === "Sortie")
        .reduce((sum, movement) => sum + movement.qty, 0)
    : 0;
  const lastMovement = state.mouvements[0];
  const alertRate = state.articles.length > 0 ? Math.round((alerts.length / state.articles.length) * 100) : 0;
  const dashboardPeriodMovements = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (topPeriodDays - 1));
    return state.mouvements.filter((movement) => {
      const movementDate = new Date(movement.date);
      return !Number.isNaN(movementDate.getTime()) && movementDate >= cutoff;
    });
  }, [state.mouvements, topPeriodDays]);
  const dashboardActivitySeries = useMemo(
    () => dashboardSeries(dashboardPeriodMovements, topPeriodDays),
    [dashboardPeriodMovements, topPeriodDays],
  );
  const dashboardMovementMix = useMemo(
    () => dashboardMix(dashboardPeriodMovements),
    [dashboardPeriodMovements],
  );
  const scanArticle = useMemo(
    () => state.articles.find((article) => article.ref.toLowerCase() === scanRef.trim().toLowerCase()),
    [scanRef, state.articles],
  );
  const filteredArticles = useMemo(() => {
    const query = catalogueSearch.trim().toLowerCase();
    return state.articles.filter((article) => {
      const matchCategory = !catalogueFilter || article.cat === catalogueFilter;
      const matchQuery =
        !query ||
        article.nom.toLowerCase().includes(query) ||
        article.ref.toLowerCase().includes(query);
      return matchCategory && matchQuery;
    });
  }, [catalogueFilter, catalogueSearch, state.articles]);
  const catalogueCategories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(state.articles.map((article) => article.cat).filter(Boolean)));
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...uniqueCategories]));
  }, [state.articles]);
  const filteredMovements = useMemo(() => {
    if (!movementFilter) {
      return state.mouvements;
    }
    return state.mouvements.filter((movement) => movement.type === movementFilter);
  }, [movementFilter, state.mouvements]);
  const monthLabel = useMemo(
    () =>
      calendarCursor.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      }),
    [calendarCursor],
  );
  const calendarDays = useMemo(() => {
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    const weekDay = (first.getDay() + 6) % 7; // lundi = 0
    start.setDate(first.getDate() - weekDay);

    const days: Array<{ key: string; date: Date; inMonth: boolean; isToday: boolean; events: Evenement[] }> = [];
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const iso = current.toISOString().slice(0, 10);
      const inMonth = current.getMonth() === m;
      const today = new Date();
      const isToday =
        current.getFullYear() === today.getFullYear() &&
        current.getMonth() === today.getMonth() &&
        current.getDate() === today.getDate();
      const events = state.evenements.filter((event) => {
        if (!event.debut) {
          return false;
        }
        const end = event.fin || event.debut;
        return event.debut <= iso && end >= iso;
      });
      days.push({ key: `${iso}-${i}`, date: current, inMonth, isToday, events });
    }
    return days;
  }, [calendarCursor, state.evenements]);
  const reportStats = useMemo(() => {
    const sorties = state.mouvements.filter((movement) => movement.type === "Sortie");
    const retours = state.mouvements.filter((movement) => movement.type === "Retour");
    const pertes = state.mouvements.filter(
      (movement) => movement.etat === "Perdu" || movement.etat === "Endommagé",
    );
    const byArticle = new Map<string, number>();
    sorties.forEach((movement) => {
      byArticle.set(movement.articleId, (byArticle.get(movement.articleId) ?? 0) + movement.qty);
    });
    const topArticles = Array.from(byArticle.entries())
      .map(([id, qty]) => ({ id, qty, article: state.articles.find((article) => article.id === id) }))
      .filter((item) => Boolean(item.article))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
    const categoryDistribution = state.articles.reduce<Record<string, number>>((acc, article) => {
      acc[article.cat] = (acc[article.cat] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalSorties: sorties.reduce((sum, movement) => sum + movement.qty, 0),
      totalRetours: retours.reduce((sum, movement) => sum + movement.qty, 0),
      totalPertes: pertes.reduce((sum, movement) => sum + movement.qty, 0),
      topArticles,
      categoryDistribution,
    };
  }, [state.articles, state.mouvements]);
  const dashboardTopArticles = useMemo(() => {
    const byArticle = new Map<string, number>();
    dashboardPeriodMovements.forEach((movement) => {
      if (movement.type !== "Sortie") {
        return;
      }
      byArticle.set(movement.articleId, (byArticle.get(movement.articleId) ?? 0) + movement.qty);
    });
    return Array.from(byArticle.entries())
      .map(([id, qty]) => ({ id, qty, article: state.articles.find((article) => article.id === id) }))
      .filter((item) => Boolean(item.article))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [dashboardPeriodMovements, state.articles]);
  const dashboardTopMax = Math.max(1, ...dashboardTopArticles.map((item) => item.qty));
  const scanHistoryItems = useMemo(() => {
    if (state.scanHistory.length > 0) {
      return state.scanHistory.slice(0, 10);
    }
    return state.mouvements.slice(0, 10).map((movement) => {
      const article = state.articles.find((item) => item.id === movement.articleId);
      return {
        type: movement.type === "Retour" ? "Retour" : "Sortie",
        artNom: article?.nom ?? "Article",
        artEmoji: article?.emoji ?? "📦",
        qty: movement.qty,
        date: movement.date,
      } as const;
    });
  }, [state.articles, state.mouvements, state.scanHistory]);
  const currentUserProfile = useMemo(
    () => state.utilisateurs.find((user) => user.id === state.currentUser) ?? state.utilisateurs[0],
    [state.currentUser, state.utilisateurs],
  );

  const profileAvatarPreview = profileAvatarDataUrl || currentUserProfile?.avatarUrl || "";

  useEffect(() => {
    if (activePage !== "scan") {
      return;
    }
    const input = document.getElementById("scanRef") as HTMLInputElement | null;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  }, [activePage]);

  function submitScan(mode: "sortie" | "retour") {
    const payload = { ref: scanRef, qty: scanQty, eventId: scanEventId };
    if (mode === "retour") {
      onScanRetour(payload);
      return;
    }
    onScanSortie(payload);
  }

  function exportCatalogueCsv() {
    const rows = [
      ["Référence", "Désignation", "Catégorie", "Qté Totale", "Disponible", "Affecté", "Valeur Unit.", "Seuil Min", "Notes"],
      ...filteredArticles.map((article) => [
        article.ref,
        article.nom,
        article.cat,
        String(article.qtyTotal),
        String(dispo(article)),
        String(article.qtyAff),
        String(article.valUnit),
        String(article.seuilMin),
        article.notes ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stockevent_catalogue.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openCsvPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        onImportCsv(file);
      }
    };
    input.click();
  }

  return (
    <main id="main">
      <div id="page-dashboard" className={pageClass(activePage, "dashboard")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Tableau de bord</div>
            <div className="ph-sub">
              Vision unifiée de l&apos;inventaire, des événements et des opérations en cours.
            </div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline btn-sm" type="button">
              ↓ Exporter
            </button>
            <button className="btn btn-gold" type="button" onClick={onOpenArticleModal}>
              + Nouvel article
            </button>
          </div>
        </div>

        <div className="dash-hero">
          <div className="dash-hero-glow" aria-hidden />
          <div className="dash-hero-main">
            <p className="dash-hero-eyebrow">Pilotage opérationnel</p>
            <h2 className="dash-hero-title">
              Performance stock en temps réel, prête pour vos prochains événements.
            </h2>
            <p className="dash-hero-sub">
              Priorisez les réapprovisionnements, sécurisez les sorties et gardez une vision claire sur la valeur de
              votre parc.
            </p>
            <div className="dash-hero-pills">
              <span className="dash-pill">{fmtNum(totalUnits)} unités</span>
              <span className="dash-pill">{fmtNum(state.evenements.length)} événements</span>
              <span className="dash-pill">{stockCoverageRate}% couverture</span>
            </div>
          </div>
          <div className="dash-hero-side">
            <div className="dash-hero-kpi">
              <span className="dash-hero-kpi-label">Valeur du stock</span>
              <strong className="dash-hero-kpi-value">{fmtNum(stockValue)}</strong>
              <span className="dash-hero-kpi-unit">F CFA</span>
            </div>
            <div className="dash-hero-kpi dash-hero-kpi-alt">
              <span className="dash-hero-kpi-label">Alertes critiques</span>
              <strong className="dash-hero-kpi-value">{fmtNum(alerts.length)}</strong>
              <span className="dash-hero-kpi-unit">articles à traiter</span>
            </div>
            <div className="dash-hero-event">
              <span className="dash-hero-event-label">Prochain jalon opérationnel</span>
              <strong className="dash-hero-event-title">{nextEvent ? nextEvent.nom : "Aucun événement planifié"}</strong>
              <span className="dash-hero-event-sub">
                {nextEvent
                  ? `${fmt(nextEvent.debut)} · ${nextEventItemsOut} unité(s) déjà sorties`
                  : "Créez un événement pour lancer la planification logistique."}
              </span>
            </div>
          </div>
        </div>

        <div className="metrics">
          <div className="mc mc-navy">
            <div className="mc-accent" />
            <div className="mc-label">Articles en stock</div>
            <div className="mc-value">{state.articles.length}</div>
            <div className="mc-sub">{fmtNum(state.articles.reduce((sum, article) => sum + article.qtyTotal, 0))} unités</div>
          </div>
          <div className="mc mc-gold">
            <div className="mc-accent" />
            <div className="mc-label">Événements actifs</div>
            <div className="mc-value">{activeEvents.length}</div>
            <div className="mc-sub">sur {state.evenements.length} événements</div>
          </div>
          <div className="mc mc-ok">
            <div className="mc-accent" />
            <div className="mc-label">Articles affectés</div>
            <div className="mc-value">{fmtNum(affectedCount)}</div>
            <div className="mc-sub">en cours d&apos;utilisation</div>
          </div>
          <div className="mc mc-warn">
            <div className="mc-accent" />
            <div className="mc-label">Alertes actives</div>
            <div className="mc-value">{alerts.length}</div>
            <div className="mc-sub">{fmtNum(stockValue)} F CFA de valeur stock</div>
          </div>
        </div>

        <div className="dash-insights">
          <div className="dash-insight-card">
            <div className="dash-insight-label">Taux d&apos;affectation</div>
            <div className="dash-insight-value">{allocationRate}%</div>
            <div className="dash-insight-sub">{fmtNum(affectedCount)} unités engagées sur {fmtNum(totalUnits)}</div>
            <div className="dash-insight-meter" aria-hidden>
              <progress className="dash-insight-meter-progress" value={allocationRate} max={100} />
            </div>
          </div>
          <div className="dash-insight-card">
            <div className="dash-insight-label">Couverture de stock</div>
            <div className="dash-insight-value">
              {stockCoverageRate}%
            </div>
            <div className="dash-insight-sub">
              {fmtNum(availableUnits)} unités disponibles sur {fmtNum(totalUnits)}
            </div>
            <div className="dash-insight-meter" aria-hidden>
              <progress className="dash-insight-meter-progress" value={stockCoverageRate} max={100} />
            </div>
          </div>
          <div className="dash-insight-card">
            <div className="dash-insight-label">Pression alertes</div>
            <div className="dash-insight-value">
              {alertRate}%
            </div>
            <div className="dash-insight-sub">
              {lastMovement
                ? `Dernier mouvement: ${lastMovement.type} · ${fmtTime(lastMovement.date)}`
                : "Aucun mouvement enregistré pour le moment."}
            </div>
            <div className="dash-insight-meter" aria-hidden>
              <progress className="dash-insight-meter-progress" value={Math.min(alertRate, 100)} max={100} />
            </div>
          </div>
        </div>

        <div className="dash-charts">
          <section className="card card-pad">
            <div className="card-title">
              <h3>▦ Tendance des mouvements ({topPeriodDays} jours)</h3>
              <div className="dash-top-controls" role="group" aria-label="Période des graphiques">
                {[7, 14, 30].map((days) => (
                  <button
                    key={`series-${days}`}
                    type="button"
                    className={`filt${topPeriodDays === days ? " active" : ""}`}
                    onClick={() => setTopPeriodDays(days as 7 | 14 | 30)}
                  >
                    {days}j
                  </button>
                ))}
              </div>
            </div>
            <ActivityAreaChart series={dashboardActivitySeries} loading={false} />
          </section>
          <section className="card card-pad">
            <div className="card-title">
              <h3>◌ Répartition du stock</h3>
            </div>
            <CategoryDonut distribution={reportStats.categoryDistribution} />
            <div className="mt12">
              <MovementMixBars mix={dashboardMovementMix} loading={false} />
            </div>
          </section>
        </div>

        <section className="card card-pad dash-top-chart">
          <div className="card-title">
            <h3>▲ Top 5 articles les plus sortis</h3>
              <span className="dash-top-caption">{topPeriodDays} derniers jours</span>
          </div>
          {dashboardTopArticles.length === 0 ? (
            <div className="empty-state">
              <p>Aucune sortie enregistrée sur {topPeriodDays} jour(s).</p>
            </div>
          ) : (
            <div className="dash-top-list">
              {dashboardTopArticles.map((item, index) => (
                <div key={item.id} className="dash-top-row">
                  <div className="dash-top-rank">{index + 1}</div>
                  <div className="dash-top-main">
                    <div className="dash-top-name">{item.article?.nom ?? "Article"}</div>
                    <div className="dash-top-ref">{item.article?.ref || "Réf. —"}</div>
                    <progress
                      className="progress-meter progress-meter-info dash-top-bar"
                      value={item.qty}
                      max={dashboardTopMax}
                    />
                  </div>
                  <div className="dash-top-val">{fmtNum(item.qty)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="dash-layout">
          <div className="dash-col">
            <div className="card card-pad">
              <div className="card-title">
                <h3>⚠ Alertes actives</h3>
                <a onClick={() => onNavigate("alertes")} role="button">
                  Tout voir →
                </a>
              </div>
              <div>
                {alerts.length === 0 ? (
                  <div className="empty-state">
                    <p>Aucune alerte active.</p>
                  </div>
                ) : (
                  alerts.slice(0, 5).map((article) => (
                    <div key={article.id} className={`alert-item${dispo(article) === 0 ? " crit" : ""}`}>
                      <span className="alert-icon">{article.emoji || "📦"}</span>
                      <div className="alert-body">
                        <div className="alert-text">
                          <strong>{article.nom}</strong> — {dispo(article) === 0 ? "Rupture de stock" : "Stock critique"} :{" "}
                          {dispo(article)} restant(s)
                        </div>
                        <div className="alert-sub">Seuil minimum : {article.seuilMin} · Réf. {article.ref || "N/A"}</div>
                      </div>
                      <button className="btn btn-xs btn-outline" type="button" onClick={() => onOrderArticle(article.id)}>
                        Commander
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card card-overflow-hidden card-pad-none">
              <div className="card-pad card-pad-no-bottom">
                <div className="card-title">
                  <h3>◈ Prochains événements</h3>
                  <a onClick={() => onNavigate("evenements")} role="button">
                    Calendrier →
                  </a>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Événement</th>
                      <th>Date</th>
                      <th>Lieu</th>
                      <th>Articles</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEvents.slice(0, 5).map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.nom}</strong>
                          <br />
                          <span className="fs11 fc-3">{event.client || "—"}</span>
                        </td>
                        <td>{fmt(event.debut)}</td>
                        <td>{event.lieu || "—"}</td>
                        <td>{state.mouvements.filter((m) => m.evId === event.id && m.type === "Sortie").length}</td>
                        <td>
                          <span className={`badge ${eventStatusClass[event.statut] ?? "badge-gray"}`}>{event.statut}</span>
                        </td>
                      </tr>
                    ))}
                    {activeEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Aucun événement actif.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="dash-col">
            <div className="card card-pad">
              <div className="card-title">
                <h3>◉ Disponibilité stock</h3>
              </div>
              <div>
                {state.articles.slice(0, 6).map((article) => {
                  const available = dispo(article);
                  const total = Math.max(1, article.qtyTotal);
                  const ratioClass = available <= Math.floor(total * 0.25) ? "progress-meter-danger" : "progress-meter-ok";
                  return (
                    <div key={article.id} className="gauge-item">
                      <div className="gauge-ico">{article.emoji || "📦"}</div>
                      <div className="gauge-info">
                        <div className="gauge-name">{article.nom}</div>
                        <div className="gauge-nums">
                          {available} / {article.qtyTotal} disponibles
                        </div>
                      </div>
                      <div className="gauge-bar">
                        <div className="gauge-pct">
                          {Math.round((available / total) * 100)}%
                        </div>
                        <progress className={`progress-meter ${ratioClass}`} value={available} max={total} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card card-pad dash-action-card">
              <div className="card-title">
                <h3>⚡ Actions rapides</h3>
              </div>
              <div className="dash-action-grid">
                <button className="btn btn-outline btn-sm" type="button" onClick={onOpenSortieModal}>
                  ↗ Nouvelle sortie
                </button>
                <button className="btn btn-outline btn-sm" type="button" onClick={onOpenRetourModal}>
                  ↩ Enregistrer retour
                </button>
                <button className="btn btn-outline btn-sm" type="button" onClick={onOpenEventModal}>
                  ◈ Créer événement
                </button>
                <button className="btn btn-gold btn-sm" type="button" onClick={() => onNavigate("alertes")}>
                  ◬ Traiter alertes
                </button>
              </div>
              <div className="dash-action-foot">
                Valeur en stock critique: <strong>{fmtNum(criticalStockValue)} F CFA</strong>
              </div>
            </div>

            <div className="card card-pad">
              <div className="card-title">
                <h3>⇄ Activité récente</h3>
                <a onClick={() => onNavigate("mouvements")} role="button">
                  Tout voir →
                </a>
              </div>
              <div className="tl-wrap">
                {state.mouvements.slice(0, 8).map((movement) => {
                  const article = state.articles.find((a) => a.id === movement.articleId);
                  const dotClass =
                    movement.type === "Retour"
                      ? "tl-dot-ok"
                      : movement.type === "Sortie"
                        ? "tl-dot-info"
                        : movement.type === "Réception"
                          ? "tl-dot-gold"
                          : "tl-dot-danger";
                  return (
                    <div key={movement.id} className="tl-item">
                      <div className={`tl-dot ${dotClass}`} />
                      <div className="tl-main">
                        <div className="tl-title">
                          {movement.type} • {article?.nom ?? "Article"}
                        </div>
                        <div className="tl-sub">
                          {movement.qty} unité(s) • {fmtTime(movement.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="page-catalogue" className={pageClass(activePage, "catalogue")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Catalogue d&apos;articles</div>
            <div className="ph-sub">{state.articles.length} article(s)</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline btn-sm" type="button" onClick={() => onNavigate("categories")}>
              ▤ Catégories
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={openCsvPicker}>
              ↑ Import CSV
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={exportCatalogueCsv}>
              ↓ Export CSV
            </button>
            <button className="btn btn-gold" type="button" onClick={onOpenArticleModal}>
              + Nouvel article
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="search-bar"
            type="text"
            id="catSearch"
            placeholder="Rechercher…"
            value={catalogueSearch ?? ""}
            onChange={(event) => setCatalogueSearch(event.target.value)}
          />
          {["", ...catalogueCategories].map((category) => (
            <button
              key={category || "all"}
              className={`filt${catalogueFilter === category ? " active" : ""}`}
              type="button"
              onClick={() => setCatalogueFilter(category)}
            >
              {category || "Tout"}
            </button>
          ))}
        </div>

        <div className="card card-overflow-hidden">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th />
                  <th>Réf.</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Total</th>
                  <th>Disponible</th>
                  <th>Affecté</th>
                  <th>Valeur unit. (F)</th>
                  <th>Alerte min.</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <div className="item-thumb">{article.emoji || "📦"}</div>
                    </td>
                    <td>
                      <span className="ref-code">{article.ref}</span>
                    </td>
                    <td>
                      <strong>{article.nom}</strong>
                      {article.notes ? <><br /><span className="fs11 fc-3">{article.notes.slice(0, 50)}{article.notes.length > 50 ? "…" : ""}</span></> : null}
                    </td>
                    <td>
                      <span className="badge badge-navy">{article.cat}</span>
                    </td>
                    <td className="fw500">{fmtNum(article.qtyTotal)}</td>
                    <td className={dispo(article) === 0 ? "fc-danger fw600" : dispo(article) <= article.seuilMin ? "fc-warn fw600" : "fc-ok fw500"}>{fmtNum(dispo(article))}</td>
                    <td>{fmtNum(article.qtyAff)}</td>
                    <td>{fmtNum(article.valUnit)}</td>
                    <td>{fmtNum(article.seuilMin)}</td>
                    <td>{dispo(article) === 0 ? <span className="badge badge-danger">Rupture</span> : dispo(article) <= article.seuilMin ? <span className="badge badge-warn">Critique</span> : <span className="badge badge-ok">Disponible</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-outline btn-xs" type="button" onClick={() => onEditArticle(article.id)}>
                          Modifier
                        </button>{" "}
                        <button className="btn btn-danger btn-xs" type="button" onClick={() => onDeleteArticle(article.id)}>
                          Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredArticles.length === 0 ? (
            <div id="cat-empty" className="empty-state">
              <div className="empty-icon">◉</div>
              <h3>Aucun article trouvé</h3>
              <p>Ajoutez votre premier article ou modifiez votre recherche.</p>
              <button className="btn btn-gold mt8" type="button" onClick={onOpenArticleModal}>
                + Ajouter un article
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div id="page-categories" className={pageClass(activePage, "categories")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Catégories</div>
            <div className="ph-sub">Référentiel utilisé par le catalogue et les analyses</div>
          </div>
          <div className="ph-actions">
            {canManageCategories ? (
              <button className="btn btn-gold" type="button" onClick={() => onOpenCategoryModal("create")}>
                + Nouvelle catégorie
              </button>
            ) : null}
          </div>
        </div>
        <div className="card card-pad cat-admin-card">
          {categoryLoading ? (
            <div className="fs12 fc-3">Chargement des catégories…</div>
          ) : categoryError ? (
            <div className="auth-error" role="alert">
              {categoryError}
            </div>
          ) : categoryRows.length === 0 ? (
            <div className="empty-state cat-admin-empty">
              <div className="empty-icon">▤</div>
              <h3>Aucune catégorie</h3>
              <p>Créez une catégorie pour classer vos articles.</p>
              {canManageCategories ? (
                <button className="btn btn-gold mt8" type="button" onClick={() => onOpenCategoryModal("create")}>
                  + Créer une catégorie
                </button>
              ) : null}
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Slug</th>
                    <th>Articles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="fs12 fc-3 mono">{row.slug}</td>
                      <td>{fmtNum(row.itemCount)}</td>
                      <td>
                        {canManageCategories ? (
                          <div className="row-actions">
                            <button
                              className="btn btn-outline btn-xs"
                              type="button"
                              onClick={() => onOpenCategoryModal("edit", row)}
                            >
                              Modifier
                            </button>{" "}
                            <button
                              className="btn btn-danger btn-xs"
                              type="button"
                              onClick={() => onRequestDeleteCategory(row)}
                              disabled={row.itemCount > 0}
                              title={row.itemCount > 0 ? "Détachez d’abord les articles de cette catégorie" : undefined}
                            >
                              Suppr.
                            </button>
                          </div>
                        ) : (
                          <span className="fs12 fc-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div id="page-evenements" className={pageClass(activePage, "evenements")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Gestion des Événements</div>
            <div className="ph-sub">{state.evenements.length} événement(s)</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-gold" type="button" onClick={onOpenEventModal}>
              + Nouvel événement
            </button>
          </div>
        </div>

        <div className="card card-pad mb18">
          <div className="cal-hd">
            <h3 id="cal-month-label">{monthLabel}</h3>
            <div className="cal-nav">
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() =>
                  setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                ‹ Préc.
              </button>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() => setCalendarCursor(new Date())}
              >
                Aujourd&apos;hui
              </button>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() =>
                  setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
              >
                Suiv. ›
              </button>
            </div>
          </div>
          <div className="cal-grid" id="cal-grid">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((name) => (
              <div key={name} className="cal-dname">
                {name}
              </div>
            ))}
            {calendarDays.map((day) => (
              <div
                key={day.key}
                className={`cal-day${day.isToday ? " today" : ""}${day.inMonth ? "" : " other"}`}
              >
                <div className="cal-num">{day.date.getDate()}</div>
                {day.events.slice(0, 2).map((event) => (
                  <div
                    key={`${day.key}-${event.id}`}
                    className={`cal-ev ${
                      event.statut === "Prêt"
                        ? "ce-ok"
                        : event.statut === "En préparation"
                          ? "ce-gold"
                          : "ce-info"
                    }`}
                  >
                    {event.nom}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="card card-overflow-hidden">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Événement</th>
                  <th>Client</th>
                  <th>Dates</th>
                  <th>Lieu</th>
                  <th>Responsable</th>
                  <th>Articles affectés</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.evenements.map((event) => (
                  <tr key={event.id}>
                    <td>{event.nom}</td>
                    <td>{event.client || "—"}</td>
                    <td>
                      {fmt(event.debut)} - {fmt(event.fin)}
                    </td>
                    <td>{event.lieu || "—"}</td>
                    <td>{event.resp || "—"}</td>
                    <td>{state.mouvements.filter((m) => m.evId === event.id && m.type === "Sortie").length}</td>
                    <td>
                      <span className={`badge ${eventStatusClass[event.statut] ?? "badge-gray"}`}>{event.statut}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-outline btn-xs"
                          type="button"
                          onClick={() => onOpenAffectModal()}
                        >
                          + Affecter
                        </button>{" "}
                        <button
                          className="btn btn-outline btn-xs"
                          type="button"
                          onClick={() => onGeneratePackingList(event.id)}
                        >
                          📄 Packing
                        </button>{" "}
                        <button className="btn btn-outline btn-xs" type="button" onClick={() => onEditEvent(event.id)}>
                          Modifier
                        </button>{" "}
                        <button className="btn btn-danger btn-xs" type="button" onClick={() => onDeleteEvent(event.id)}>
                          Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.evenements.length === 0 ? (
            <div id="ev-empty" className="empty-state">
              <div className="empty-icon">◈</div>
              <h3>Aucun événement</h3>
              <p>Créez votre premier événement pour commencer.</p>
              <button className="btn btn-gold mt8" type="button" onClick={onOpenEventModal}>
                + Créer un événement
              </button>
            </div>
          ) : null}
        </div>
        <div className="actions-row-end mt12">
          <button className="btn btn-outline btn-sm" type="button" onClick={onOpenAffectModal}>
            + Affecter des articles
          </button>
        </div>
      </div>

      <div id="page-mouvements" className={pageClass(activePage, "mouvements")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Mouvements de stock</div>
            <div className="ph-sub">Historique complet des entrées, sorties et retours</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline" type="button" onClick={onOpenSortieModal}>
              ↗ Enregistrer une sortie
            </button>
            <button className="btn btn-gold" type="button" onClick={onOpenRetourModal}>
              ↩ Enregistrer un retour
            </button>
          </div>
        </div>
        <div className="filter-bar">
          {["", "Sortie", "Retour", "Réception", "Perte"].map((filter) => (
            <button
              key={filter || "all-movements"}
              className={`filt${movementFilter === filter ? " active" : ""}`}
              type="button"
              onClick={() => setMovementFilter(filter)}
            >
              {filter
                ? filter === "Sortie"
                  ? "↗ Sorties"
                  : filter === "Retour"
                    ? "↩ Retours"
                    : filter === "Réception"
                      ? "+ Réceptions"
                      : "✕ Pertes"
                : "Tous"}
            </button>
          ))}
        </div>
        <div className="card card-overflow-hidden">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Article</th>
                  <th>Qté</th>
                  <th>Événement</th>
                  <th>Opérateur</th>
                  <th>État</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => {
                  const article = state.articles.find((a) => a.id === movement.articleId);
                  const event = state.evenements.find((e) => e.id === movement.evId);
                  return (
                    <tr key={movement.id}>
                      <td>{fmtTime(movement.date)}</td>
                      <td>
                        <span className={`badge ${movementBadgeClass[movement.type] ?? "badge-gray"}`}>
                          {movement.type === "Sortie" ? "↗ " : movement.type === "Retour" ? "↩ " : movement.type === "Réception" ? "+ " : movement.type === "Perte" ? "✕ " : ""}
                          {movement.type}
                        </span>
                      </td>
                      <td>
                        {article ? (
                          <>
                            <strong>{article.nom}</strong>
                            <br />
                            <span className="fs11 fc-3">{article.ref}</span>
                          </>
                        ) : (
                          <span className="fc-3">Article supprimé</span>
                        )}
                      </td>
                      <td className="fw600">
                        {movement.type === "Retour" ? "+" : "−"}
                        {fmtNum(movement.qty)}
                      </td>
                      <td>{event?.nom ?? "—"}</td>
                      <td>{movement.operateur || "—"}</td>
                      <td>
                        {movement.etat ? (
                          <span className={`badge ${etatBadgeClass(movement.etat)}`}>{movement.etat}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="fs12">{movement.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredMovements.length === 0 ? (
            <div id="mvt-empty" className="empty-state">
              <div className="empty-icon">⇄</div>
              <h3>Aucun mouvement</h3>
              <p>Les sorties et retours d&apos;articles apparaîtront ici.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div id="page-rapports" className={`${pageClass(activePage, "rapports")} page-analytics`}>
        <AnalyticsRapports
          dashboard={dashData}
          dashboardLoading={dashLoading}
          dashboardError={dashErr}
          reportStats={reportStats}
          stockValue={stockValue}
          state={state}
          eventStatusClass={eventStatusClass}
          onNavigate={onNavigate}
          onPrintReport={onPrintReport}
          auditLogs={auditLogs}
          auditLoading={auditLoading}
          auditError={auditError}
          auditHasMore={auditHasMore}
          auditSkip={auditSkip}
          loadAuditLogs={loadAuditLogs}
        />
      </div>

      <div id="page-alertes" className={pageClass(activePage, "alertes")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Gestion des Alertes</div>
            <div className="ph-sub">{alerts.length} alerte(s) active(s)</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline btn-sm" type="button" onClick={onRefreshAlerts}>
              ↻ Actualiser
            </button>
          </div>
        </div>
        <div id="alertes-list">
          {alerts.map((article) => (
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
                      {dispo(article)} unité(s) disponible(s) · Seuil min: {article.seuilMin} · Réf: {article.ref || "N/A"} · Catégorie: {article.cat}
                    </div>
                    <div className="fs12 fc-3">Valeur unitaire: {fmtNum(article.valUnit)} F CFA · Qté totale: {article.qtyTotal}</div>
                  </div>
                </div>
                <div className="alert-card-actions">
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => onEditArticle(article.id)}>
                    Modifier seuil
                  </button>
                  <button className="btn btn-sm btn-gold" type="button" onClick={() => onOrderArticle(article.id)}>
                    Commander
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {alerts.length === 0 ? (
          <div id="alertes-empty" className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>Aucune alerte active</h3>
            <p>Tous les stocks sont au-dessus du seuil minimum. Bravo !</p>
          </div>
        ) : null}
      </div>

      <div id="page-scan" className={pageClass(activePage, "scan")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Scan &amp; Sortie rapide</div>
            <div className="ph-sub">Enregistrement rapide par référence article</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline btn-sm" type="button" onClick={onToggleSound}>
              {soundEnabled ? "🔊 Son ON" : "🔇 Son OFF"}
            </button>
          </div>
        </div>
        <div className="grid-2 gap18">
          <div className="card card-pad">
            <div className="card-title">
              <h3>Scan article</h3>
            </div>
            <div className="scan-zone">
              <div className="scan-glyph">⊙</div>
              <div className="scan-zone-title">
                Scanner un article
              </div>
              <div className="scan-zone-subtitle">
                Cliquez ici, puis entrez ou scannez la référence
              </div>
            </div>
            <div className="mt16">
              <div className="fg full mb12">
                <label>Référence article</label>
                <input
                  className="fi"
                  type="text"
                  id="scanRef"
                  placeholder="Ex: MOB-001"
                  value={scanRef ?? ""}
                  onChange={(event) => setScanRef(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    submitScan(event.shiftKey ? "retour" : "sortie");
                  }}
                />
              </div>
              {scanArticle ? (
                <div
                  id="scan-article-preview"
                  className="scan-article-preview"
                >
                  <strong>
                    {scanArticle.emoji} {scanArticle.nom}
                  </strong>
                  <div className="scan-article-sub">
                    Réf: {scanArticle.ref} • Disponible: {dispo(scanArticle)}
                  </div>
                </div>
              ) : null}
              <div className="fg full mb12">
                <label>Quantité</label>
                <input
                  className="fi"
                  type="number"
                  id="scanQty"
                  aria-label="Quantité"
                  value={Number.isFinite(scanQty) ? scanQty : 1}
                  onChange={(event) => setScanQty(Number.parseInt(event.target.value, 10) || 1)}
                  min={1}
                />
              </div>
              <div className="fg full mb12">
                <label>Événement associé</label>
                <select
                  className="fs"
                  id="scanEvent"
                  aria-label="Événement associé"
                  value={scanEventId ?? ""}
                  onChange={(event) => setScanEventId(event.target.value)}
                >
                  <option value="">— Aucun —</option>
                  {activeEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid-2 gap10">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => submitScan("sortie")}
                >
                  ↗ Enregistrer sortie
                </button>
                <button
                  className="btn btn-gold"
                  type="button"
                  onClick={() => submitScan("retour")}
                >
                  ↩ Enregistrer retour
                </button>
              </div>
              <div className="scan-shortcut">
                Raccourci: Entrée = sortie rapide, Shift+Entrée = retour rapide.
              </div>
            </div>
          </div>
          <div className="card card-pad">
            <div className="card-title">
              <h3>Derniers scans</h3>
            </div>
            <div id="scan-history">
              {scanHistoryItems.map((scanItem, index) => {
                const movementType = scanItem.type;
                return (
                  <div
                    key={`${scanItem.date}-${index}`}
                    className="scan-history-item"
                  >
                    <span className="scan-history-emoji">{scanItem.artEmoji}</span>
                    <div className="scan-history-main">
                      <div className="fs12 fw500">{scanItem.artNom}</div>
                      <div className="fs11 fc-3">
                        {scanItem.qty} unité(s) • {fmtTime(scanItem.date)}
                      </div>
                    </div>
                    {movementType === "Sortie" ? <span className="badge badge-danger">↗ Sortie</span> : <span className="badge badge-ok">↩ Retour</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div id="page-profil" className={pageClass(activePage, "profil")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Mon profil utilisateur</div>
            <div className="ph-sub">Gérez vos informations personnelles</div>
          </div>
        </div>
        <div className="card card-pad">
          {currentUserProfile ? (
            <div
              className="form-grid"
              key={`${currentUserProfile.id}-${currentUserProfile.prenom}-${currentUserProfile.nom}-${currentUserProfile.email}`}
            >
              <div className="fg">
                <label>Prénom *</label>
                <input
                  className="fi"
                  id="profile-prenom"
                  defaultValue={currentUserProfile.prenom}
                  placeholder="Prénom"
                  aria-label="Prénom"
                />
              </div>
              <div className="fg">
                <label>Nom *</label>
                <input
                  className="fi"
                  id="profile-nom"
                  defaultValue={currentUserProfile.nom}
                  placeholder="Nom"
                  aria-label="Nom"
                />
              </div>
              <div className="fg full">
                <label>Avatar</label>
                <div className="avatar-upload-row">
                  <div className="foot-av avatar-preview-lg">
                    {profileAvatarPreview ? (
                      <Image
                        src={profileAvatarPreview}
                        alt={`${currentUserProfile.prenom} ${currentUserProfile.nom}`}
                        fill
                        className="avatar-image"
                        sizes="52px"
                      />
                    ) : (
                      (currentUserProfile.prenom?.[0] ?? "") + (currentUserProfile.nom?.[0] ?? "")
                    )}
                  </div>
                  <input
                    className="fi"
                    type="file"
                    accept="image/*"
                    aria-label="Avatar"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setProfileAvatarDataUrl(String(reader.result ?? ""));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>
              <div className="fg full">
                <label>Email *</label>
                <input
                  className="fi"
                  id="profile-email"
                  type="email"
                  defaultValue={currentUserProfile.email}
                  placeholder="email@agence.ci"
                  aria-label="Email"
                />
              </div>
              <div className="fg full">
                <label>Rôle</label>
                <input className="fi" value={currentUserProfile.role} readOnly aria-label="Rôle" />
              </div>
              <div className="fg">
                <label>Mot de passe actuel</label>
                <input
                  className="fi"
                  id="profile-current-password"
                  type="password"
                  placeholder="••••••••"
                  aria-label="Mot de passe actuel"
                />
              </div>
              <div className="fg">
                <label>Nouveau mot de passe</label>
                <input
                  className="fi"
                  id="profile-new-password"
                  type="password"
                  placeholder="8 caractères minimum"
                  aria-label="Nouveau mot de passe"
                />
              </div>
              <div className="fg full">
                <button
                  className="btn btn-gold"
                  type="button"
                  onClick={() =>
                    onSaveProfile({
                      prenom: (document.getElementById("profile-prenom") as HTMLInputElement | null)?.value ?? "",
                      nom: (document.getElementById("profile-nom") as HTMLInputElement | null)?.value ?? "",
                      email: (document.getElementById("profile-email") as HTMLInputElement | null)?.value ?? "",
                      avatarUrl: profileAvatarPreview || null,
                      currentPassword:
                        (document.getElementById("profile-current-password") as HTMLInputElement | null)?.value ?? "",
                      newPassword:
                        (document.getElementById("profile-new-password") as HTMLInputElement | null)?.value ?? "",
                    })
                  }
                >
                  Enregistrer mon profil
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Profil utilisateur introuvable.</p>
            </div>
          )}
        </div>
      </div>

      <div id="page-utilisateurs" className={pageClass(activePage, "utilisateurs")}>
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">Gestion des Utilisateurs</div>
            <div className="ph-sub">{state.utilisateurs.length} utilisateur(s)</div>
          </div>
          <div className="ph-actions">
            {canManageUsers ? (
              <button className="btn btn-gold" type="button" onClick={onOpenUserModal}>
                + Ajouter utilisateur
              </button>
            ) : null}
          </div>
        </div>
        <div className="card card-overflow-hidden">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Identifiant</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Dernière action</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.utilisateurs.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-inline">
                        <div
                          className="foot-av user-inline-avatar"
                        >
                          {(user.prenom?.[0] ?? "") + (user.nom?.[0] ?? "")}
                        </div>
                        <div>
                          <div className="fw500">{user.prenom} {user.nom}</div>
                        </div>
                      </div>
                    </td>
                    <td className="fc-3 fs12">{user.username ?? "—"}</td>
                    <td className="fc-3 fs12">{user.email}</td>
                    <td><span className={`badge ${roleBadgeClass[user.role] ?? "badge-gray"}`}>{user.role}</span></td>
                    <td>—</td>
                    <td><span className={`badge ${user.actif ? "badge-ok" : "badge-gray"}`}>{user.actif ? "Actif" : "Inactif"}</span></td>
                    <td>
                      {canManageUsers ? (
                        <div className="row-actions">
                          <button className="btn btn-outline btn-xs" type="button" onClick={() => onEditUser(user.id)}>
                            Modif.
                          </button>{" "}
                          <button className="btn btn-danger btn-xs" type="button" onClick={() => onDeleteUser(user.id)}>
                            Suppr.
                          </button>
                        </div>
                      ) : (
                        <span className="fc-3 fs12">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

