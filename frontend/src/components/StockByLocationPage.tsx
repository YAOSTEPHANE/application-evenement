"use client";

import { PageHeader } from "@/components/PageHeader";
import { AppIcon } from "@/components/icons/AppIcon";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchLocationStockLines,
  fetchLocationStockSummary,
  fetchWarehouses,
  type LocationStockLineRow,
  type LocationStockSummaryResponse,
  type WarehouseRow,
} from "@/lib/stock/api";
import { fmtNum } from "@/lib/stock/helpers";

import type { PageId } from "./Sidebar";

type StockByLocationPageProps = {
  activePage: PageId;
  pageClass: (page: PageId, id: PageId) => string;
};

type AggregatedRow = Pick<
  LocationStockLineRow,
  | "id"
  | "itemName"
  | "itemReference"
  | "itemEmoji"
  | "variantLabel"
  | "warehouseName"
  | "zoneName"
  | "locationCode"
  | "hierarchyCoordinate"
  | "systemQty"
  | "availableQty"
  | "reservedQty"
  | "inTransitQty"
  | "physicalQty"
  | "varianceQty"
>;

export function StockByLocationPage({ activePage, pageClass }: StockByLocationPageProps) {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [summary, setSummary] = useState<LocationStockSummaryResponse | null>(null);
  const [lines, setLines] = useState<LocationStockLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"emplacement" | "zone" | "entrepot" | "total">("emplacement");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wh = warehouseId || undefined;
      const [sum, rows] = await Promise.all([
        fetchLocationStockSummary(wh),
        fetchLocationStockLines(wh ? { warehouseId: wh } : undefined),
      ]);
      setSummary(sum);
      setLines(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
      setSummary(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    void fetchWarehouses()
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    if (activePage !== "stock-localisation") {
      return;
    }
    void load();
  }, [activePage, load]);

  const groupedRows = useMemo((): AggregatedRow[] => {
    if (view === "emplacement") {
      return lines;
    }
    if (view === "zone" && summary) {
      return summary.byZone.map((z) => {
        const first = lines.find((l) => l.storageZoneId === z.id);
        return {
          id: z.id,
          itemName: first?.zoneName ?? "Zone",
          itemReference: first?.zoneCode ?? "",
          itemEmoji: "\u25A6",
          variantLabel: null,
          warehouseName: first?.warehouseName ?? "",
          zoneName: first?.zoneName ?? "",
          locationCode: "\u2014",
          hierarchyCoordinate: null,
          ...z.totals,
        };
      });
    }
    if (view === "entrepot" && summary) {
      return summary.byWarehouse.map((w) => ({
        id: w.id,
        itemName: w.name,
        itemReference: w.code,
        itemEmoji: "\uD83C\uDFED",
        variantLabel: null,
        warehouseName: w.name,
        zoneName: "\u2014",
        locationCode: "\u2014",
        hierarchyCoordinate: null,
        ...w.totals,
      }));
    }
    if (summary) {
      return [
        {
          id: "org-total",
          itemName: "Stock total localis\u00E9",
          itemReference: "ORG",
          itemEmoji: "\u03A3",
          variantLabel: null,
          warehouseName: "Tous sites",
          zoneName: "\u2014",
          locationCode: "\u2014",
          hierarchyCoordinate: null,
          ...summary.totals,
        },
      ];
    }
    return lines;
  }, [view, lines, summary]);

  const t = summary?.totals;

  return (
    <div id="page-stock-localisation" className={pageClass(activePage, "stock-localisation")}>
      <PageHeader
        icon="location"
        title="Stock par localisation"
        subtitle="Emplacement, zone, entrepôt, physique vs système"
        actions={
          <>
            <select
              className="fs"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-label="Filtrer par entrepôt"
            >
              <option value="">Tous les entrepôts</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm btn-icon" type="button" onClick={() => void load()}>
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
          </>
        }
      />

      {error ? (
        <div className="auth-error card-pad mb16" role="alert">
          {error}
        </div>
      ) : null}

      {t ? (
        <div className="stats-grid mb16">
          <div className="stat-card">
            <div className="stat-label">Stock systeme</div>
            <div className="stat-val">{fmtNum(t.systemQty)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Disponible</div>
            <div className="stat-val">{fmtNum(t.availableQty)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reserve</div>
            <div className="stat-val">{fmtNum(t.reservedQty)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">En transit</div>
            <div className="stat-val">{fmtNum(t.inTransitQty)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Physique</div>
            <div className="stat-val">{fmtNum(t.physicalQty)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ecart phys. / syst.</div>
            <div className={`stat-val${t.varianceQty !== 0 ? " text-warn" : ""}`}>
              {t.varianceQty > 0 ? "+" : ""}{fmtNum(t.varianceQty)}
            </div>
          </div>
        </div>
      ) : null}

      {summary && summary.unallocated.availableQty > 0 ? (
        <div className="card card-pad mb16 fs12">
          <strong>Non reparti :</strong> {fmtNum(summary.unallocated.availableQty)} disponible(s).
        </div>
      ) : null}

      <div className="mb12" role="tablist">
        {(
          [
            ["emplacement", "Par emplacement"],
            ["zone", "Par zone"],
            ["entrepot", "Par entrepot"],
            ["total", "Stock total"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm${view === key ? " btn-gold" : " btn-outline"}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card card-overflow-hidden">
        {loading ? (
          <div className="card-pad fs12 fc-3">Chargement…</div>
        ) : groupedRows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📍</div>
            <h3>Aucun stock localise</h3>
            <p>Repartissez le stock depuis les emplacements.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Entrepot</th>
                  <th>Zone</th>
                  <th>Emplacement</th>
                  <th>Systeme</th>
                  <th>Disponible</th>
                  <th>Reserve</th>
                  <th>Transit</th>
                  <th>Physique</th>
                  <th>Ecart</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.itemName}</strong></td>
                    <td className="fs12">{row.warehouseName}</td>
                    <td className="fs12">{row.zoneName}</td>
                    <td className="fs12 mono">{row.hierarchyCoordinate || row.locationCode || "—"}</td>
                    <td>{fmtNum(row.systemQty)}</td>
                    <td>{fmtNum(row.availableQty)}</td>
                    <td>{fmtNum(row.reservedQty)}</td>
                    <td>{fmtNum(row.inTransitQty)}</td>
                    <td>{fmtNum(row.physicalQty)}</td>
                    <td>{fmtNum(row.varianceQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
