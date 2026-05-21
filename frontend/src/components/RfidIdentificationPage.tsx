"use client";

import { ItemCondition, RfidTagType, TrackedAssetStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import { RfidHandheldsPanel } from "@/components/RfidHandheldsPanel";
import { ModalRoot } from "@/components/ModalRoot";
import { useToastContext } from "@/lib/toast/ToastProvider";
import { RfidModuleCapabilities } from "@/components/RfidModuleCapabilities";
import { RfidPortiquesPanel } from "@/components/RfidPortiquesPanel";
import { RfidTagTypologyPanel } from "@/components/RfidTagTypologyPanel";
import { conditionRequiresQuarantine } from "@/lib/rfid-quarantine";
import {
  ASSET_STATUS_LABELS,
  ITEM_CONDITION_LABELS,
  RFID_TAG_LABELS,
} from "@/lib/cdc-labels";
import {
  getRfidTagTypology,
  suggestRfidTagTypeFromMaterialHint,
} from "@/lib/rfid-tag-typology";
import { clientFetch } from "@/lib/stock/api";
import type { Article } from "@/lib/stock/types";

type WarehouseOption = { id: string; name: string; code: string };
type CategoryOption = { id: string; name: string; code: string };

type RfidStats = {
  totalUnits: number;
  catalogItems: number;
  quarantine: number;
  onSite: number;
  inTransit: number;
  coveragePct: number;
  totalQuantity: number;
  taggedUnits: number;
};

type AssetRow = {
  id: string;
  tagCode: string;
  tagCodeValidatedAt?: string | null;
  rfidTagType: keyof typeof RFID_TAG_LABELS;
  status: keyof typeof ASSET_STATUS_LABELS;
  condition: keyof typeof ITEM_CONDITION_LABELS;
  photoUrl?: string | null;
  notes?: string | null;
  item: {
    id: string;
    name: string;
    reference: string;
    photoUrl?: string | null;
    emoji?: string | null;
    technicalParams?: string | null;
    category?: { id: string; name: string; code: string };
  };
  currentWarehouse?: { id: string; name: string; code: string } | null;
};

type CatalogRow = {
  id: string;
  name: string;
  reference: string;
  photoUrl?: string | null;
  emoji?: string | null;
  technicalParams?: string | null;
  defaultRfidTagType?: keyof typeof RFID_TAG_LABELS | null;
  category: { id: string; name: string; code: string };
  unitCount: number;
  totalQuantity: number;
};

type AssetDetail = AssetRow & {
  currentEvent?: { name: string; location: string; clientName: string } | null;
  movementHistory: Array<{
    at: string;
    documentNumber: string;
    kind: string;
    status: string;
    scannedQty: number;
    expectedQty: number;
  }>;
  custodyHistory: Array<{
    id: string;
    phase: string;
    startedAt: string;
    eventName?: string | null;
    documentNumber?: string | null;
  }>;
};

type SampleResult = {
  scanned: number;
  matched: Array<{ tagCode: string; itemName: string; status: string; condition: string }>;
  unknownTags: string[];
  quarantineHits: string[];
  missingInSample: Array<{ tagCode: string; itemName: string }>;
  sampleCoveragePct: number;
};

type RfidIdentificationPageProps = {
  articles: Article[];
  warehouses: WarehouseOption[];
  categories: CategoryOption[];
};

type TabId = "catalog" | "units" | "typology" | "portiques" | "douchettes" | "inventory";

function conditionBadgeClass(condition: keyof typeof ITEM_CONDITION_LABELS): string {
  if (condition === "NEEDS_REPAIR") return "badge-warn";
  if (condition === "OBSOLETE") return "badge-danger";
  if (condition === "NEW") return "badge-info";
  return "badge-ok";
}

function statusBadgeClass(status: keyof typeof ASSET_STATUS_LABELS): string {
  if (status === "QUARANTINE") return "badge-warn";
  if (status === "SCRAPPED") return "badge-danger";
  if (status === "IN_TRANSIT") return "badge-info";
  if (status === "ON_SITE") return "badge-ok";
  return "badge-ok";
}

export function RfidIdentificationPage({
  articles,
  warehouses,
  categories,
}: RfidIdentificationPageProps) {
  const [tab, setTab] = useState<TabId>("catalog");
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [tagTypeFilter, setTagTypeFilter] = useState("");
  const [catalogTagTypeFilter, setCatalogTagTypeFilter] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [stats, setStats] = useState<RfidStats | null>(null);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToastContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newItemId, setNewItemId] = useState("");
  const [newTagType, setNewTagType] = useState<keyof typeof RFID_TAG_LABELS>("ADHESIVE");
  const [newWarehouseId, setNewWarehouseId] = useState("");
  const [newCondition, setNewCondition] = useState<keyof typeof ITEM_CONDITION_LABELS>("GOOD");

  const [sampleTags, setSampleTags] = useState("");
  const [sampleWarehouseId, setSampleWarehouseId] = useState("");
  const [sampleResult, setSampleResult] = useState<SampleResult | null>(null);

  const newTagTypology = useMemo(
    () => getRfidTagTypology(newTagType as RfidTagType),
    [newTagType],
  );

  useEffect(() => {
    if (!newItemId) return;
    const catRow = catalog.find((c) => c.id === newItemId);
    const art = articles.find((a) => a.id === newItemId);
    if (catRow?.defaultRfidTagType) {
      setNewTagType(catRow.defaultRfidTagType);
      return;
    }
    const hint = [catRow?.name, art?.nom, art?.cat, catRow?.category.name].filter(Boolean).join(" ");
    setNewTagType(suggestRfidTagTypeFromMaterialHint(hint));
  }, [newItemId, catalog, articles]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (warehouseId) p.set("warehouseId", warehouseId);
    if (categoryId) p.set("categoryId", categoryId);
    if (statusFilter) p.set("status", statusFilter);
    if (conditionFilter) p.set("condition", conditionFilter);
    if (tagTypeFilter) p.set("rfidTagType", tagTypeFilter);
    return p.toString();
  }, [q, warehouseId, categoryId, statusFilter, conditionFilter, tagTypeFilter]);

  const loadStats = useCallback(async () => {
    const res = await clientFetch("/api/rfid-tags/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientFetch(`/api/rfid-tags?${queryString}`);
      if (res.ok) setAssets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (categoryId) p.set("categoryId", categoryId);
      if (catalogTagTypeFilter) p.set("defaultRfidTagType", catalogTagTypeFilter);
      const res = await clientFetch(`/api/rfid-tags/catalog?${p}`);
      if (res.ok) setCatalog(await res.json());
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, catalogTagTypeFilter]);

  const refresh = useCallback(async () => {
    await loadStats();
    if (tab === "catalog") await loadCatalog();
    else if (tab === "units") await loadAssets();
  }, [tab, loadAssets, loadCatalog, loadStats]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openDetail(id: string) {
    setSelectedId(id);
    const res = await clientFetch(`/api/rfid-tags/${id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function suggestTag() {
    const cat = categories.find((c) => c.id === categoryId);
    const res = await clientFetch(
      `/api/rfid-tags?suggest=1&categoryCode=${encodeURIComponent(cat?.code ?? "GEN")}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { tagCode: string };
      setNewTag(data.tagCode);
    }
  }

  async function createUnit() {
    if (!newTag.trim() || !newItemId) {
      showToast("Tag et article obligatoires.");
      return;
    }
    const res = await clientFetch("/api/rfid-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagCode: newTag.trim(),
        itemId: newItemId,
        rfidTagType: newTagType,
        condition: newCondition,
        currentWarehouseId: newWarehouseId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Création impossible");
      return;
    }
    showToast(`Unité ${newTag} enregistrée.`);
    setCreateOpen(false);
    setTab("units");
    await refresh();
  }

  async function updateDetailCondition(condition: keyof typeof ITEM_CONDITION_LABELS) {
    if (!detail) return;
    const res = await clientFetch(`/api/rfid-tags/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDetail({ ...detail, ...updated });
      await loadAssets();
      await loadStats();
      showToast(
        conditionRequiresQuarantine(condition)
          ? "Quarantaine numérique appliquée."
          : "État mis à jour.",
      );
    }
  }

  async function validateTagCode() {
    if (!detail) return;
    const res = await clientFetch(`/api/rfid-tags/${detail.id}/validate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Validation impossible");
      return;
    }
    setDetail({ ...detail, ...(data as AssetDetail) });
    showToast("Codification TAG validée — modification du tag bloquée.");
    await loadAssets();
  }

  async function runSample() {
    const tagCodes = sampleTags
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagCodes.length === 0) return;
    const res = await clientFetch("/api/rfid-tags/inventory-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagCodes,
        warehouseId: sampleWarehouseId || undefined,
      }),
    });
    if (res.ok) {
      setSampleResult(await res.json());
      showToast("Analyse du sondage terminée.");
    } else {
      showToast("Échec inventaire sondage");
    }
  }

  const tabCounts = useMemo(
    () => ({
      catalog: stats?.catalogItems ?? catalog.length,
      units: stats?.totalUnits ?? assets.length,
    }),
    [stats, catalog.length, assets.length],
  );

  const coverageStyle = sampleResult
    ? {
        background: `conic-gradient(var(--gold) ${sampleResult.sampleCoveragePct * 3.6}deg, var(--surface3) 0deg)`,
      }
    : undefined;

  return (
    <div id="page-rfid" className="page active rfid-premium">
      <header className="rfid-hero">
        <div className="rfid-hero-visual" aria-hidden>
          <div className="rfid-hero-ring" />
          <div className="rfid-hero-ring" />
          <div className="rfid-hero-ring" />
        </div>
        <div className="rfid-hero-grid">
          <div>
            <h1 className="rfid-hero-title">Identification RFID</h1>
          </div>
          <div className="rfid-hero-actions">
            <button
              type="button"
              className="rfid-hero-btn rfid-hero-btn--ghost"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <AppIcon name="sync" size={16} />
              Actualiser
            </button>
            <button
              type="button"
              className="rfid-hero-btn rfid-hero-btn--primary"
              onClick={() => {
                setCreateOpen(true);
                setTab("units");
              }}
            >
              <AppIcon name="plus" size={16} />
              Nouvelle unité
            </button>
          </div>
        </div>
      </header>

      {stats ? (
        <div className="rfid-kpi-row">
          <article className="rfid-kpi rfid-kpi--accent">
            <div className="rfid-kpi-icon">
              <AppIcon name="rfid" size={18} />
            </div>
            <div className="rfid-kpi-val">{stats.totalUnits}</div>
            <div className="rfid-kpi-lbl">Unités taguées</div>
          </article>
          <article className="rfid-kpi">
            <div className="rfid-kpi-icon">
              <AppIcon name="package" size={18} />
            </div>
            <div className="rfid-kpi-val">{stats.catalogItems}</div>
            <div className="rfid-kpi-lbl">Références catalogue</div>
          </article>
          <article className="rfid-kpi">
            <div className="rfid-kpi-icon">
              <AppIcon name="scan" size={18} />
            </div>
            <div className="rfid-kpi-val">{stats.coveragePct}%</div>
            <div className="rfid-kpi-lbl">Couverture RFID</div>
          </article>
          <article className="rfid-kpi">
            <div className="rfid-kpi-icon">
              <AppIcon name="location" size={18} />
            </div>
            <div className="rfid-kpi-val">{stats.onSite}</div>
            <div className="rfid-kpi-lbl">Sur site</div>
          </article>
          <article className={`rfid-kpi${stats.quarantine > 0 ? " rfid-kpi--warn" : ""}`}>
            <div className="rfid-kpi-icon">
              <AppIcon name="shield" size={18} />
            </div>
            <div className="rfid-kpi-val">{stats.quarantine}</div>
            <div className="rfid-kpi-lbl">Quarantaine</div>
          </article>
        </div>
      ) : null}

      <RfidModuleCapabilities
        activeTab={tab === "typology" || tab === "portiques" ? undefined : tab}
        onNavigate={(t) => setTab(t)}
      />

      <nav className="rfid-seg-nav" role="tablist" aria-label="Vues identification">
        {(
          [
            ["catalog", "Catalogue", "package", tabCounts.catalog] as const,
            ["units", "Unités taguées", "rfid", tabCounts.units] as const,
            ["typology", "Typologie tags", "package", 5] as const,
            ["portiques", "Portiques", "warehouse", null] as const,
            ["douchettes", "Douchettes", "scan", null] as const,
            ["inventory", "Inventaire sondage", "scan", null] as const,
          ]
        ).map(([id, label, icon, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rfid-seg-btn${tab === id ? " rfid-seg-btn--active" : ""}`}
            onClick={() => setTab(id)}
          >
            <AppIcon name={icon} size={16} />
            {label}
            {count !== null ? <span className="rfid-seg-count">{count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "typology" ? (
        <RfidTagTypologyPanel
          selectedType={newTagType as RfidTagType}
          onSelectType={(t) => {
            setNewTagType(t);
            setTab("units");
            setCreateOpen(true);
          }}
        />
      ) : null}

      {tab === "catalog" || tab === "units" ? (
      <div className="rfid-toolbar">
        <div className="rfid-toolbar-grid">
          <div className="rfid-field">
            <label htmlFor="rfid-search">Recherche multicritère</label>
            <input
              id="rfid-search"
              placeholder="Tag, désignation, catégorie, emplacement…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="rfid-field">
            <label htmlFor="rfid-cat">Catégorie</label>
            <select id="rfid-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rfid-field">
            <label htmlFor="rfid-wh">Emplacement</label>
            <select id="rfid-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Tous sites</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          {tab === "catalog" ? (
            <div className="rfid-field">
              <label htmlFor="rfid-cat-tt">Type de tag (référence)</label>
              <select
                id="rfid-cat-tt"
                value={catalogTagTypeFilter}
                onChange={(e) => setCatalogTagTypeFilter(e.target.value)}
              >
                <option value="">Tous</option>
                {(Object.keys(RFID_TAG_LABELS) as RfidTagType[]).map((t) => (
                  <option key={t} value={t}>
                    {RFID_TAG_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {tab === "units" ? (
            <>
              <div className="rfid-field">
                <label htmlFor="rfid-st">Statut</label>
                <select id="rfid-st" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {(Object.keys(ASSET_STATUS_LABELS) as TrackedAssetStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ASSET_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rfid-field">
                <label htmlFor="rfid-cond">État physique</label>
                <select
                  id="rfid-cond"
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value)}
                >
                  <option value="">Tous</option>
                  {(Object.keys(ITEM_CONDITION_LABELS) as ItemCondition[]).map((c) => (
                    <option key={c} value={c}>
                      {ITEM_CONDITION_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rfid-field">
                <label htmlFor="rfid-tt">Type de tag</label>
                <select id="rfid-tt" value={tagTypeFilter} onChange={(e) => setTagTypeFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {(Object.keys(RFID_TAG_LABELS) as RfidTagType[]).map((t) => (
                    <option key={t} value={t}>
                      {RFID_TAG_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
        <div className="rfid-toolbar-foot">
          <button type="button" className="btn btn-gold btn-sm btn-icon" disabled={loading} onClick={() => void refresh()}>
            <AppIcon name="sync" size={14} />
            Appliquer les filtres
          </button>
          {tab === "units" ? (
            <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => setCreateOpen(true)}>
              <AppIcon name="plus" size={14} />
              Associer un tag
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {tab === "catalog" ? (
        <div className="rfid-catalog-grid">
          {catalog.length === 0 ? (
            <div className="rfid-empty">Aucun article dans le catalogue — enrichissez le stock d&apos;abord.</div>
          ) : (
            catalog.map((row) => {
              const pct =
                row.totalQuantity > 0
                  ? Math.min(100, Math.round((row.unitCount / row.totalQuantity) * 100))
                  : 0;
              return (
                <article key={row.id} className="rfid-catalog-card">
                  <div className="rfid-catalog-photo">
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.photoUrl} alt="" />
                    ) : (
                      <span className="rfid-catalog-emoji">{row.emoji ?? "📦"}</span>
                    )}
                  </div>
                  <div className="rfid-catalog-body">
                    <div className="rfid-catalog-name">{row.name}</div>
                    <div className="rfid-catalog-ref">
                      {row.reference} · {row.category.name}
                    </div>
                    {row.defaultRfidTagType ? (
                      <span className="rfid-catalog-tag-type">
                        {RFID_TAG_LABELS[row.defaultRfidTagType]}
                      </span>
                    ) : null}
                    {row.technicalParams ? (
                      <p className="fs12 text-muted" style={{ marginTop: 8 }}>
                        {row.technicalParams}
                      </p>
                    ) : null}
                    <div className="rfid-catalog-meter">
                      <div className="rfid-catalog-meter-hd">
                        <span>Unités taguées</span>
                        <span>
                          {row.unitCount} / {row.totalQuantity}
                        </span>
                      </div>
                      <div className="rfid-catalog-meter-bar">
                        <div className="rfid-catalog-meter-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "units" ? (
        <div className="rfid-split">
          <div className="rfid-units-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>Tag RFID</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Type</th>
                  <th>État</th>
                  <th>Statut</th>
                  <th>Site</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="rfid-empty">
                      Aucune unité — créez un tag ou parcourez le catalogue.
                    </td>
                  </tr>
                ) : (
                  assets.map((row) => (
                    <tr
                      key={row.id}
                      className={`rfid-row-click${selectedId === row.id ? " rfid-row-click--active" : ""}`}
                      onClick={() => void openDetail(row.id)}
                    >
                      <td>
                        {row.photoUrl || row.item.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.photoUrl ?? row.item.photoUrl ?? ""}
                            alt=""
                            className="rfid-thumb"
                          />
                        ) : (
                          <span>{row.item.emoji ?? "📦"}</span>
                        )}
                      </td>
                      <td>
                        <span className="rfid-tag-code">{row.tagCode}</span>
                      </td>
                      <td>
                        <span className="fw500">{row.item.name}</span>
                        <span className="fs12 text-muted" style={{ display: "block" }}>
                          {row.item.reference}
                        </span>
                      </td>
                      <td>{row.item.category?.name ?? "—"}</td>
                      <td className="fs12">{RFID_TAG_LABELS[row.rfidTagType]}</td>
                      <td>
                        <span className={`badge ${conditionBadgeClass(row.condition)}`}>
                          {ITEM_CONDITION_LABELS[row.condition]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(row.status)}`}>
                          {ASSET_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="fs12">{row.currentWarehouse?.name ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {detail ? (
            <aside className="rfid-drawer">
              <div className="rfid-drawer-hd">
                <div className="rfid-drawer-tag-row">
                  <div className="rfid-drawer-tag">{detail.tagCode}</div>
                  {detail.tagCodeValidatedAt ? (
                    <span className="badge badge-ok">Codification validée</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-gold"
                      onClick={() => void validateTagCode()}
                    >
                      Valider la codification
                    </button>
                  )}
                </div>
                <h2 className="rfid-drawer-title">{detail.item.name}</h2>
                <p className="fs12 text-muted" style={{ marginTop: 6 }}>
                  {detail.item.reference} · {detail.item.category?.name}
                </p>
                <div className="rfid-chip-row" style={{ marginTop: 12 }}>
                  <span className={`badge ${conditionBadgeClass(detail.condition)}`}>
                    {ITEM_CONDITION_LABELS[detail.condition]}
                  </span>
                  <span className={`badge ${statusBadgeClass(detail.status)}`}>
                    {ASSET_STATUS_LABELS[detail.status]}
                  </span>
                </div>
              </div>
              <div className="rfid-drawer-body">
                <div className="rfid-drawer-meta">
                  <div className="rfid-meta-card">
                    <label>Localisation</label>
                    <p>
                      {detail.currentWarehouse?.name ?? "—"}
                      {detail.currentEvent ? (
                        <>
                          <br />
                          <span className="text-muted">Chantier : {detail.currentEvent.name}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="rfid-meta-card">
                    <label>Type de tag</label>
                    <p>{RFID_TAG_LABELS[detail.rfidTagType]}</p>
                  </div>
                </div>

                <p className="fs11 fw500 text-muted" style={{ marginBottom: 8 }}>
                  CHANGER L&apos;ÉTAT PHYSIQUE
                </p>
                <div className="rfid-chip-row">
                  {(Object.keys(ITEM_CONDITION_LABELS) as ItemCondition[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`rfid-chip${detail.condition === c ? " rfid-chip--active" : ""}`}
                      onClick={() => void updateDetailCondition(c)}
                    >
                      {ITEM_CONDITION_LABELS[c]}
                    </button>
                  ))}
                </div>

                {detail.item.technicalParams ? (
                  <p className="fs12" style={{ margin: "16px 0" }}>
                    <strong>Caractéristiques</strong> — {detail.item.technicalParams}
                  </p>
                ) : null}

                <h4 className="fs12 fw500" style={{ marginTop: 16 }}>
                  Historique mouvements
                </h4>
                <ul className="rfid-timeline">
                  {detail.movementHistory.length === 0 ? (
                    <li>Aucun mouvement documenté.</li>
                  ) : (
                    detail.movementHistory.map((h, i) => (
                      <li key={`${h.documentNumber}-${i}`}>
                        {new Date(h.at).toLocaleString("fr-FR")} — {h.kind}{" "}
                        <span className="rfid-tag-code" style={{ fontSize: 10 }}>
                          {h.documentNumber}
                        </span>
                        <br />
                        Scan {h.scannedQty}/{h.expectedQty}
                      </li>
                    ))
                  )}
                </ul>

                <h4 className="fs12 fw500" style={{ marginTop: 16 }}>
                  Chaîne de responsabilité
                </h4>
                <ul className="rfid-timeline">
                  {detail.custodyHistory.length === 0 ? (
                    <li>Aucune étape enregistrée.</li>
                  ) : (
                    detail.custodyHistory.map((h) => (
                      <li key={h.id}>
                        {h.phase}
                        {h.eventName ? ` · ${h.eventName}` : ""}
                        {h.documentNumber ? ` · ${h.documentNumber}` : ""}
                        <br />
                        <span className="text-muted">
                          {new Date(h.startedAt).toLocaleDateString("fr-FR")}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </aside>
          ) : (
            <aside className="rfid-drawer rfid-drawer--empty">
              <div>
                <AppIcon name="rfid" size={32} />
                <p style={{ marginTop: 12 }}>
                  Sélectionnez une unité pour afficher le détail, l&apos;historique et modifier
                  l&apos;état.
                </p>
              </div>
            </aside>
          )}
        </div>
      ) : null}

      {tab === "portiques" ? <RfidPortiquesPanel warehouses={warehouses} /> : null}

      {tab === "douchettes" ? <RfidHandheldsPanel warehouses={warehouses} /> : null}

      {tab === "inventory" ? (
        <div className="rfid-inventory">
          <div className="rfid-scan-panel">
            <h3>Inventaire par sondage</h3>
            <p className="fs13 text-muted">
              Collez les tags lus sur une zone avec la douchette (sync terrain). Le système détecte
              les écarts, la quarantaine automatique et les tags inconnus.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              style={{ marginBottom: 12 }}
              onClick={() => setTab("douchettes")}
            >
              <AppIcon name="scan" size={14} />
              Gérer les douchettes
            </button>
            <div className="rfid-field">
              <label htmlFor="sample-wh">Périmètre</label>
              <select
                id="sample-wh"
                value={sampleWarehouseId}
                onChange={(e) => setSampleWarehouseId(e.target.value)}
              >
                <option value="">Parc global actif</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rfid-field">
              <label htmlFor="sample-tags">Tags scannés</label>
            </div>
            <textarea
              id="sample-tags"
              className="rfid-scan-textarea"
              value={sampleTags}
              onChange={(e) => setSampleTags(e.target.value)}
              placeholder="TAG-MOBC-0001 TAG-MOBC-0002 …"
            />
            <button type="button" className="btn btn-gold btn-icon" onClick={() => void runSample()}>
              <AppIcon name="scan" size={16} />
              Analyser le sondage
            </button>
          </div>

          <div className="rfid-result-panel">
            <h3 className="fs14 fw500" style={{ textAlign: "center", marginBottom: 16 }}>
              Résultat
            </h3>
            {sampleResult ? (
              <>
                <div className="rfid-coverage-ring" style={coverageStyle}>
                  <div className="rfid-coverage-val">
                    <span>{sampleResult.sampleCoveragePct}%</span>
                    <span>couverture</span>
                  </div>
                </div>
                <div className="rfid-result-stats">
                  <div className="rfid-result-stat">
                    <strong>{sampleResult.matched.length}</strong>
                    <span>Reconnus</span>
                  </div>
                  <div className="rfid-result-stat">
                    <strong>{sampleResult.unknownTags.length}</strong>
                    <span>Inconnus</span>
                  </div>
                  <div className="rfid-result-stat">
                    <strong>{sampleResult.quarantineHits.length}</strong>
                    <span>Quarantaine</span>
                  </div>
                </div>
                <p className="fs12 text-muted" style={{ textAlign: "center", marginTop: 16 }}>
                  {sampleResult.scanned} tags analysés
                </p>
                {sampleResult.quarantineHits.length > 0 ? (
                  <p className="fs12" style={{ color: "var(--warn)", marginTop: 12 }}>
                    Quarantaine : {sampleResult.quarantineHits.join(", ")}
                  </p>
                ) : null}
                {sampleResult.unknownTags.length > 0 ? (
                  <p className="fs12" style={{ color: "var(--danger)", marginTop: 8 }}>
                    Inconnus : {sampleResult.unknownTags.join(", ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="fs13 text-muted" style={{ textAlign: "center", padding: "24px 0" }}>
                Lancez une analyse pour afficher la couverture et les écarts RFID.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <ModalRoot isOpen={createOpen} className="rfid-modal-premium">
          <div className="modal" role="dialog" aria-modal="true">
            <h3 className="fw500 mb12">Nouvelle unité RFID</h3>
            <p className="fs13 text-muted mb16">Associez un tag unique à un article du catalogue.</p>
            <div className="form-grid form-premium">
              <div className="fg full">
                <label>Article *</label>
                <select className="fs" value={newItemId} onChange={(e) => setNewItemId(e.target.value)}>
                  <option value="">—</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.nom} ({a.ref})
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Tag *</label>
                <input className="fi" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
              </div>
              <div className="fg" style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void suggestTag()}>
                  Suggérer
                </button>
              </div>
              <div className="fg full">
                <label>Type de support RFID *</label>
                <select
                  className="fs"
                  value={newTagType}
                  onChange={(e) => setNewTagType(e.target.value as keyof typeof RFID_TAG_LABELS)}
                >
                  {(Object.keys(RFID_TAG_LABELS) as RfidTagType[]).map((t) => (
                    <option key={t} value={t}>
                      {RFID_TAG_LABELS[t]} — {getRfidTagTypology(t).materials}
                    </option>
                  ))}
                </select>
                <p className="rfid-typology-hint" role="note">
                  <strong>{newTagTypology.title}</strong> — {newTagTypology.particularities}
                </p>
              </div>
              <div className="fg">
                <label>État initial</label>
                <select
                  className="fs"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value as keyof typeof ITEM_CONDITION_LABELS)}
                >
                  {(Object.keys(ITEM_CONDITION_LABELS) as ItemCondition[]).map((c) => (
                    <option key={c} value={c}>
                      {ITEM_CONDITION_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg full">
                <label>Entrepôt</label>
                <select className="fs" value={newWarehouseId} onChange={(e) => setNewWarehouseId(e.target.value)}>
                  <option value="">—</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-ft">
              <button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-gold" onClick={() => void createUnit()}>
                Enregistrer
              </button>
            </div>
          </div>
        </ModalRoot>
      ) : null}
    </div>
  );
}
