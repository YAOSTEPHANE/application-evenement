"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CategoryAdminTree } from "@/components/CategoryAdminTree";
import { AppIcon } from "@/components/icons/AppIcon";
import type { CategoryAdminStats } from "@/lib/category-admin-stats-db";
import {
  buildCategoryTree,
  categoryLevelLabel,
  categoryPathLabel,
  type CategoryTreeNode,
} from "@/lib/category-tree";
import {
  fetchCategoriesWithCounts,
  type CategoryParentPreset,
  type CategoryWithCount,
} from "@/lib/stock/api";
import { fmtNum } from "@/lib/stock/helpers";

import type { PageId } from "@/components/Sidebar";

type ViewMode = "tree" | "cards";
type ActiveFilter = "all" | "active" | "inactive";
type LevelFilter = "" | "0" | "1" | "2";

type CategoriesAdminPageProps = {
  reloadToken: number;
  canManage: boolean;
  onNavigate: (page: PageId) => void;
  onOpenCategoryModal: (
    mode: "create" | "edit",
    row?: CategoryWithCount,
    parentPreset?: CategoryParentPreset,
  ) => void;
  onRequestDeleteCategory: (row: CategoryWithCount) => void;
  onToggleCategoryActive?: (row: CategoryWithCount, active: boolean) => void;
};

function filterCategoryRows(
  rows: CategoryWithCount[],
  search: string,
  levelFilter: LevelFilter,
  activeFilter: ActiveFilter,
): CategoryWithCount[] {
  const q = search.trim().toLowerCase();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const matches = (row: CategoryWithCount) => {
    if (levelFilter !== "" && row.level !== Number(levelFilter)) return false;
    if (activeFilter === "active" && !row.active) return false;
    if (activeFilter === "inactive" && row.active) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.code.toLowerCase().includes(q) ||
      row.slug.toLowerCase().includes(q) ||
      (row.description?.toLowerCase().includes(q) ?? false)
    );
  };

  if (!q && levelFilter === "" && activeFilter === "all") {
    return rows;
  }

  const keep = new Set<string>();
  for (const row of rows) {
    if (!matches(row)) continue;
    keep.add(row.id);
    let parentId = row.parentId;
    while (parentId) {
      keep.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  return rows.filter((r) => keep.has(r.id));
}

function RootCategoryCard({
  node,
  selected,
  onSelect,
}: {
  node: CategoryTreeNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`categ-card${selected ? " categ-card--active" : ""}${node.active ? "" : " categ-card--inactive"}`}
      onClick={() => onSelect(node.id)}
    >
      <div className="categ-card-top">
        {node.photoUrl ? (
          <Image src={node.photoUrl} alt="" width={40} height={40} className="categ-card-photo" unoptimized />
        ) : (
          <span className="categ-card-icon">{node.icon || "▤"}</span>
        )}
        <span className={`badge ${node.active ? "badge-ok" : "badge-gray"}`}>
          {node.active ? "Actif" : "Inactif"}
        </span>
      </div>
      <h3 className="categ-card-title">{node.name}</h3>
      <p className="categ-card-code">{node.code}</p>
      <div className="categ-card-stats">
        <span>{fmtNum(node.itemCount)} article(s)</span>
        <span>{fmtNum(node.children.length)} sous-niveau(x)</span>
      </div>
    </button>
  );
}

export function CategoriesAdminPage({
  reloadToken,
  canManage,
  onNavigate,
  onOpenCategoryModal,
  onRequestDeleteCategory,
  onToggleCategoryActive,
}: CategoriesAdminPageProps) {
  const [stats, setStats] = useState<CategoryAdminStats | null>(null);
  const [rows, setRows] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [view, setView] = useState<ViewMode>("tree");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCategoriesWithCounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les catégories");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/categories/stats");
      if (res.ok) setStats((await res.json()) as CategoryAdminStats);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
    void loadStats();
  }, [loadRows, loadStats, reloadToken]);

  const filteredRows = useMemo(
    () => filterCategoryRows(rows, search, levelFilter, activeFilter),
    [rows, search, levelFilter, activeFilter],
  );

  const tree = useMemo(() => buildCategoryTree(filteredRows), [filteredRows]);
  const rootNodes = useMemo(() => tree.filter((n) => n.level === 0), [tree]);

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );

  const handleAddChild = (parent: CategoryParentPreset) => {
    onOpenCategoryModal("create", undefined, parent);
  };

  const handleToggle = onToggleCategoryActive ?? (() => undefined);

  return (
    <div className="categ-premium">
      <section className="categ-hero">
        <div className="categ-hero-grid">
          <div>
            <h1 className="categ-hero-title">Catégories</h1>
          </div>
          <div className="categ-hero-actions">
            <button
              type="button"
              className="categ-hero-btn categ-hero-btn--ghost"
              disabled={loading || statsLoading}
              onClick={() => {
                void loadRows();
                void loadStats();
              }}
            >
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
            <button type="button" className="categ-hero-btn categ-hero-btn--ghost" onClick={() => onNavigate("catalogue")}>
              <AppIcon name="catalogue" size={14} />
              Catalogue
            </button>
            {canManage ? (
              <button
                type="button"
                className="categ-hero-btn categ-hero-btn--gold"
                onClick={() => onOpenCategoryModal("create")}
              >
                <AppIcon name="plus" size={14} />
                Nouvelle catégorie
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="categ-kpi-row">
        <article className="categ-kpi">
          <div className="categ-kpi-val">{stats?.total ?? rows.length}</div>
          <div className="categ-kpi-lbl">Catégories</div>
        </article>
        <article className="categ-kpi categ-kpi--ok">
          <div className="categ-kpi-val">{stats?.active ?? "—"}</div>
          <div className="categ-kpi-lbl">Actives</div>
        </article>
        <article className={`categ-kpi${(stats?.inactive ?? 0) > 0 ? " categ-kpi--muted" : ""}`}>
          <div className="categ-kpi-val">{stats?.inactive ?? "—"}</div>
          <div className="categ-kpi-lbl">Inactives</div>
        </article>
        <article className="categ-kpi">
          <div className="categ-kpi-val">{stats?.itemsLinked ?? "—"}</div>
          <div className="categ-kpi-lbl">Articles rattachés</div>
        </article>
        <article className="categ-kpi">
          <div className="categ-kpi-val">{stats?.level0 ?? "—"}</div>
          <div className="categ-kpi-lbl">Racines</div>
          <div className="categ-kpi-sub">
            {stats ? `${stats.level1} enfant · ${stats.level2} sous-enfant` : ""}
          </div>
        </article>
        <article className={`categ-kpi${(stats?.emptyCategories ?? 0) > 0 ? " categ-kpi--warn" : ""}`}>
          <div className="categ-kpi-val">{stats?.emptyCategories ?? "—"}</div>
          <div className="categ-kpi-lbl">Vides (sans article ni enfant)</div>
        </article>
        <article className="categ-kpi">
          <div className="categ-kpi-val">{stats?.withChildren ?? "—"}</div>
          <div className="categ-kpi-lbl">Avec sous-catégories</div>
        </article>
      </div>

      <div className="categ-toolbar">
        <AppIcon name="search" size={16} />
        <input
          type="search"
          className="categ-search"
          placeholder="Nom, code, slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="categ-select"
          aria-label="Filtrer par niveau"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
        >
          <option value="">Tous niveaux</option>
          <option value="0">Racine</option>
          <option value="1">Enfant</option>
          <option value="2">Sous-enfant</option>
        </select>
        <select
          className="categ-select"
          aria-label="Filtrer par statut"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
        </select>
        <div className="categ-view-toggle" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={`categ-view-btn${view === "tree" ? " categ-view-btn--on" : ""}`}
            onClick={() => setView("tree")}
          >
            Arbre
          </button>
          <button
            type="button"
            className={`categ-view-btn${view === "cards" ? " categ-view-btn--on" : ""}`}
            onClick={() => setView("cards")}
          >
            Racines
          </button>
        </div>
        <span className="categ-result-count">{filteredRows.length} catégorie(s)</span>
      </div>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className={`categ-layout${selected ? " categ-layout--drawer" : ""}`}>
        <div className="categ-main">
          {loading ? (
            <div className="categ-loading">Chargement des catégories…</div>
          ) : filteredRows.length === 0 ? (
            <div className="categ-empty">
              <div className="empty-icon">▤</div>
              <h3>Aucune catégorie</h3>
              <p>
                {rows.length === 0
                  ? "Créez une catégorie racine pour structurer le catalogue."
                  : "Aucun résultat pour ces filtres."}
              </p>
              {canManage && rows.length === 0 ? (
                <button type="button" className="btn btn-gold mt8" onClick={() => onOpenCategoryModal("create")}>
                  Créer une catégorie
                </button>
              ) : null}
            </div>
          ) : view === "cards" ? (
            <div className="categ-grid">
              {rootNodes.map((node) => (
                <RootCategoryCard
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          ) : (
            <div className="categ-tree-panel">
              <CategoryAdminTree
                rows={filteredRows}
                canManage={canManage}
                selectedId={selectedId}
                onSelect={(row) => setSelectedId(row.id)}
                onEdit={(row) => onOpenCategoryModal("edit", row)}
                onDelete={onRequestDeleteCategory}
                onAddChild={handleAddChild}
                onToggleActive={handleToggle}
              />
            </div>
          )}
        </div>

        {selected ? (
          <aside className="categ-drawer">
            <div className="categ-drawer-hd">
              {selected.photoUrl ? (
                <Image
                  src={selected.photoUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="categ-drawer-photo"
                  unoptimized
                />
              ) : (
                <span className="categ-drawer-icon">{selected.icon || "▤"}</span>
              )}
              <div>
                <h2>{selected.name}</h2>
                <p className="categ-drawer-code">{selected.code}</p>
              </div>
              <button
                type="button"
                className="categ-drawer-close"
                onClick={() => setSelectedId(null)}
                aria-label="Fermer"
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>
            <div className="categ-drawer-body">
              <span className={`badge ${selected.active ? "badge-ok" : "badge-gray"}`}>
                {selected.active ? "Actif" : "Inactif"}
              </span>
              <span className="badge badge-navy">{categoryLevelLabel(selected.level)}</span>
              <dl className="categ-dl">
                <div>
                  <dt>Chemin</dt>
                  <dd>{categoryPathLabel(rows, selected.id)}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd className="mono">{selected.slug}</dd>
                </div>
                <div>
                  <dt>Articles directs</dt>
                  <dd>{fmtNum(selected.itemCount)}</dd>
                </div>
                <div>
                  <dt>Sous-catégories</dt>
                  <dd>{fmtNum(selected.childrenCount)}</dd>
                </div>
                {selected.description ? (
                  <div>
                    <dt>Description</dt>
                    <dd className="categ-drawer-desc">{selected.description}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {canManage ? (
              <div className="categ-drawer-ft">
                {selected.level < 2 ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      handleAddChild({
                        id: selected.id,
                        name: selected.name,
                        code: selected.code,
                        level: selected.level,
                      })
                    }
                  >
                    + Sous-catégorie
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleToggle(selected, !selected.active)}
                >
                  {selected.active ? "Désactiver" : "Activer"}
                </button>
                <button type="button" className="btn btn-gold btn-sm" onClick={() => onOpenCategoryModal("edit", selected)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={selected.itemCount > 0 || selected.childrenCount > 0}
                  title={
                    selected.itemCount > 0 || selected.childrenCount > 0
                      ? "Retirez les articles et sous-catégories avant suppression"
                      : undefined
                  }
                  onClick={() => {
                    onRequestDeleteCategory(selected);
                    setSelectedId(null);
                  }}
                >
                  Supprimer
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
