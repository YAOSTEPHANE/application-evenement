"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import type { CatalogStats } from "@/lib/catalog-db";
import {
  articleStockStatus,
  dispo,
  fmtNum,
  isArticleStockAlert,
} from "@/lib/stock/helpers";
import {
  stockLevelBadgeClass,
  stockLevelStatusLabel,
} from "@/lib/stock-level-helpers";
import type { Article } from "@/lib/stock/types";

import type { MovementUiType } from "@/lib/movement-helpers";
import type { PageId } from "@/components/Sidebar";

const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

type ViewMode = "grid" | "table";
type SortKey = "nom" | "ref" | "stock" | "alert";

type ArticlesCatalogPageProps = {
  articles: Article[];
  onNavigate: (page: PageId) => void;
  onOpenArticleModal: () => void;
  onEditArticle: (id: string) => void;
  onDeleteArticle: (id: string) => void;
  onImportCsv: (file: File) => void;
  onOpenReceptionModal?: () => void;
  onOpenMovementModal?: (preset?: MovementUiType) => void;
};

function stockStatusCardClass(article: Article): string {
  const status = articleStockStatus(article);
  if (status === "rupture" || status === "critical") return "cat-card--danger";
  if (status === "alert" || status === "reorder" || status === "below_safety") return "cat-card--warn";
  if (status === "overstock") return "cat-card--info";
  return "cat-card--ok";
}

export function ArticlesCatalogPage({
  articles,
  onNavigate,
  onOpenArticleModal,
  onEditArticle,
  onDeleteArticle,
  onImportCsv,
  onOpenReceptionModal,
  onOpenMovementModal,
}: ArticlesCatalogPageProps) {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("nom");
  const [alertOnly, setAlertOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalog/stats");
      if (res.ok) setStats((await res.json()) as CatalogStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const fromArticles = articles.map((a) => a.cat).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromArticles])).sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
  }, [articles]);

  const alertCount = useMemo(() => articles.filter((a) => isArticleStockAlert(a)).length, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = articles.filter((a) => {
      if (category && a.cat !== category) return false;
      if (alertOnly && !isArticleStockAlert(a)) return false;
      if (!q) return true;
      return (
        a.nom.toLowerCase().includes(q) ||
        a.ref.toLowerCase().includes(q) ||
        a.cat.toLowerCase().includes(q) ||
        (a.brand?.toLowerCase().includes(q) ?? false)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "ref") return a.ref.localeCompare(b.ref, "fr");
      if (sort === "stock") return dispo(b) - dispo(a);
      if (sort === "alert") {
        const sa = isArticleStockAlert(a) ? 1 : 0;
        const sb = isArticleStockAlert(b) ? 1 : 0;
        return sb - sa || a.nom.localeCompare(b.nom, "fr");
      }
      return a.nom.localeCompare(b.nom, "fr");
    });
    return list;
  }, [articles, search, category, alertOnly, sort]);

  const selected = useMemo(
    () => (selectedId ? articles.find((a) => a.id === selectedId) ?? null : null),
    [articles, selectedId],
  );

  function exportCsv() {
    const rows = [
      [
        "Référence",
        "Désignation",
        "Catégorie",
        "Qté totale",
        "Disponible",
        "Affecté",
        "Valeur unit.",
        "Seuil min",
        "Notes",
      ],
      ...filtered.map((article) => [
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
      .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
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
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) onImportCsv(file);
    };
    input.click();
  }

  return (
    <div className="cat-premium">
      <section className="cat-hero">
        <div className="cat-hero-grid">
          <div>
            <h1 className="cat-hero-title">Articles</h1>
          </div>
          <div className="cat-hero-actions">
            <button
              type="button"
              className="cat-hero-btn cat-hero-btn--ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
            <button type="button" className="cat-hero-btn cat-hero-btn--ghost" onClick={() => onNavigate("categories")}>
              <AppIcon name="categories" size={14} />
              Catégories
            </button>
            <button type="button" className="cat-hero-btn cat-hero-btn--ghost" onClick={openCsvPicker}>
              <AppIcon name="upload" size={14} />
              Import
            </button>
            <button type="button" className="cat-hero-btn cat-hero-btn--ghost" onClick={exportCsv}>
              <AppIcon name="fileExport" size={14} />
              Export
            </button>
            {(onOpenReceptionModal ?? onOpenMovementModal) ? (
              <button
                type="button"
                className="cat-hero-btn cat-hero-btn--ghost"
                onClick={onOpenReceptionModal ?? (() => onOpenMovementModal?.("Entrée"))}
              >
                <AppIcon name="plus" size={14} />
                Réception
              </button>
            ) : null}
            <button type="button" className="cat-hero-btn cat-hero-btn--gold" onClick={onOpenArticleModal}>
              <AppIcon name="plus" size={14} />
              Nouvel article
            </button>
          </div>
        </div>
      </section>

      <div className="cat-kpi-row">
        <article className="cat-kpi">
          <div className="cat-kpi-val">{stats?.articlesCount ?? articles.length}</div>
          <div className="cat-kpi-lbl">Articles</div>
        </article>
        <article className="cat-kpi">
          <div className="cat-kpi-val">{fmtNum(stats?.totalUnits ?? 0)}</div>
          <div className="cat-kpi-lbl">Unités en stock</div>
          <div className="cat-kpi-sub">{fmtNum(stats?.availableUnits ?? 0)} disponibles</div>
        </article>
        <article className={`cat-kpi${alertCount > 0 ? " cat-kpi--warn" : ""}`}>
          <div className="cat-kpi-val">{alertCount}</div>
          <div className="cat-kpi-lbl">Alertes stock</div>
        </article>
        <article className="cat-kpi cat-kpi--accent">
          <div className="cat-kpi-val">{fmtNum(stats?.stockValueEstimate ?? 0)}</div>
          <div className="cat-kpi-lbl">Valeur stock (F CFA)</div>
        </article>
        <article className="cat-kpi">
          <div className="cat-kpi-val">{stats?.categoriesCount ?? categories.length}</div>
          <div className="cat-kpi-lbl">Catégories actives</div>
        </article>
        <article className="cat-kpi">
          <div className="cat-kpi-val">{stats?.variantProducts ?? 0}</div>
          <div className="cat-kpi-lbl">Multi-variantes</div>
        </article>
        <article className="cat-kpi">
          <div className="cat-kpi-val">{stats?.itemsWithRfid ?? "—"}</div>
          <div className="cat-kpi-lbl">Familles taguées RFID</div>
        </article>
      </div>

      <div className="cat-toolbar">
        <AppIcon name="search" size={16} />
        <input
          type="search"
          className="cat-search"
          placeholder="Nom, référence, marque, catégorie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="cat-select"
          aria-label="Filtrer par catégorie"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="cat-select"
          aria-label="Trier les articles"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="nom">Tri : nom</option>
          <option value="ref">Tri : référence</option>
          <option value="stock">Tri : disponible</option>
          <option value="alert">Tri : alertes d&apos;abord</option>
        </select>
        <label className="cat-check">
          <input type="checkbox" checked={alertOnly} onChange={(e) => setAlertOnly(e.target.checked)} />
          Alertes seulement
        </label>
        <div className="cat-view-toggle" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={`cat-view-btn${view === "grid" ? " cat-view-btn--on" : ""}`}
            onClick={() => setView("grid")}
          >
            Grille
          </button>
          <button
            type="button"
            className={`cat-view-btn${view === "table" ? " cat-view-btn--on" : ""}`}
            onClick={() => setView("table")}
          >
            Liste
          </button>
        </div>
        <span className="cat-result-count">{filtered.length} résultat(s)</span>
      </div>

      <div className={`cat-layout${selected ? " cat-layout--drawer" : ""}`}>
        <div className="cat-main">
          {filtered.length === 0 ? (
            <div className="cat-empty">
              <p>Aucun article ne correspond aux critères.</p>
              <button type="button" className="btn btn-gold" onClick={onOpenArticleModal}>
                Créer un article
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="cat-grid">
              {filtered.map((article) => {
                const available = dispo(article);
                const status = articleStockStatus(article);
                return (
                  <button
                    key={article.id}
                    type="button"
                    className={`cat-card ${stockStatusCardClass(article)}${selectedId === article.id ? " cat-card--active" : ""}`}
                    onClick={() => setSelectedId(article.id)}
                  >
                    <div className="cat-card-top">
                      <span className="cat-card-emoji">{article.emoji || "📦"}</span>
                      <span className={`badge ${stockLevelBadgeClass(status)}`}>
                        {stockLevelStatusLabel(status)}
                      </span>
                    </div>
                    <h3 className="cat-card-title">{article.nom}</h3>
                    <p className="cat-card-ref">{article.ref}</p>
                    <p className="cat-card-cat">{article.cat}</p>
                    <div className="cat-card-stats">
                      <span>
                        <strong>{fmtNum(available)}</strong> dispo.
                      </span>
                      <span>{fmtNum(article.qtyTotal)} total</span>
                    </div>
                    {article.hasVariants ? (
                      <span className="cat-card-tag">{article.variants.length} variante(s)</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap cat-table-wrap">
              <table className="data-table cat-table">
                <thead>
                  <tr>
                    <th />
                    <th>Réf.</th>
                    <th>Désignation</th>
                    <th>Catégorie</th>
                    <th>Disponible</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((article) => {
                    const status = articleStockStatus(article);
                    return (
                      <tr
                        key={article.id}
                        className={selectedId === article.id ? "cat-row--active" : undefined}
                        onClick={() => setSelectedId(article.id)}
                      >
                        <td>
                          <span className="cat-card-emoji">{article.emoji || "📦"}</span>
                        </td>
                        <td className="fw500">{article.ref}</td>
                        <td>{article.nom}</td>
                        <td>{article.cat}</td>
                        <td>{fmtNum(dispo(article))}</td>
                        <td>{fmtNum(article.qtyTotal)}</td>
                        <td>
                          <span className={`badge ${stockLevelBadgeClass(status)}`}>
                            {stockLevelStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditArticle(article.id);
                            }}
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected ? (
          <aside className="cat-drawer">
            <div className="cat-drawer-hd">
              <span className="cat-drawer-emoji">{selected.emoji || "📦"}</span>
              <div>
                <h2>{selected.nom}</h2>
                <p className="cat-drawer-ref">{selected.ref}</p>
              </div>
              <button type="button" className="cat-drawer-close" onClick={() => setSelectedId(null)} aria-label="Fermer">
                <AppIcon name="close" size={16} />
              </button>
            </div>
            <div className="cat-drawer-body">
              <span className={`badge ${stockLevelBadgeClass(articleStockStatus(selected))}`}>
                {stockLevelStatusLabel(articleStockStatus(selected))}
              </span>
              <dl className="cat-dl">
                <div>
                  <dt>Catégorie</dt>
                  <dd>{selected.cat}</dd>
                </div>
                <div>
                  <dt>Disponible / total</dt>
                  <dd>
                    {fmtNum(dispo(selected))} / {fmtNum(selected.qtyTotal)} (affecté {fmtNum(selected.qtyAff)})
                  </dd>
                </div>
                <div>
                  <dt>Valeur unitaire</dt>
                  <dd>{fmtNum(selected.valUnit)} F CFA</dd>
                </div>
                {selected.brand ? (
                  <div>
                    <dt>Marque</dt>
                    <dd>{selected.brand}</dd>
                  </div>
                ) : null}
                {selected.condition ? (
                  <div>
                    <dt>État</dt>
                    <dd>{selected.condition}</dd>
                  </div>
                ) : null}
                {selected.hasVariants ? (
                  <div>
                    <dt>Variantes</dt>
                    <dd>{selected.variants.length} référence(s) SKU</dd>
                  </div>
                ) : null}
                {selected.description ? (
                  <div>
                    <dt>Description</dt>
                    <dd className="cat-drawer-desc">{selected.description}</dd>
                  </div>
                ) : null}
                {selected.notes ? (
                  <div>
                    <dt>Notes</dt>
                    <dd className="cat-drawer-desc">{selected.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="cat-drawer-ft">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("rfid")}>
                <AppIcon name="rfid" size={14} />
                RFID
              </button>
              <button type="button" className="btn btn-gold btn-sm" onClick={() => onEditArticle(selected.id)}>
                Modifier
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  onDeleteArticle(selected.id);
                  setSelectedId(null);
                }}
              >
                Supprimer
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
