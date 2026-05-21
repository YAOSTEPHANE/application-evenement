"use client";

import { PageHeader } from "@/components/PageHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import { mapsUrl } from "@/lib/warehouse-helpers";
import type { WarehouseRow } from "@/lib/stock/api";
import { fmtNum } from "@/lib/stock/helpers";

import type { PageId } from "./Sidebar";

type WarehouseAdminPageProps = {
  activePage: PageId;
  pageClass: (page: PageId, id: PageId) => string;
  canManage: boolean;
  loading: boolean;
  error: string | null;
  rows: WarehouseRow[];
  search: string;
  showInactive: boolean;
  onSearchChange: (value: string) => void;
  onToggleShowInactive: () => void;
  onOpenModal: (mode: "create" | "edit", row?: WarehouseRow) => void;
  onManageZones: (row: WarehouseRow) => void;
  onToggleActive: (row: WarehouseRow, active: boolean) => void;
  onRequestDelete: (row: WarehouseRow) => void;
};

export function WarehouseAdminPage({
  activePage,
  pageClass,
  canManage,
  loading,
  error,
  rows,
  search,
  showInactive,
  onSearchChange,
  onToggleShowInactive,
  onOpenModal,
  onManageZones,
  onToggleActive,
  onRequestDelete,
}: WarehouseAdminPageProps) {
  return (
    <div id="page-entrepots" className={pageClass(activePage, "entrepots")}>
      <PageHeader
        icon="warehouse"
        title="Entrepôts & magasins"
        subtitle="Sites de stockage · GPS · capacité · accès · conditions"
        actions={
          canManage ? (
            <button className="btn btn-gold btn-icon" type="button" onClick={() => onOpenModal("create")}>
              <AppIcon name="plus" size={14} />
              Nouveau site
            </button>
          ) : null
        }
      />
      <div className="filter-bar">
        <input
          className="fi search-input"
          placeholder="Rechercher un site…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="button" className={`filt${showInactive ? " active" : ""}`} onClick={onToggleShowInactive}>
          {showInactive ? "Masquer inactifs" : "Afficher inactifs"}
        </button>
      </div>
      <div className="card card-overflow-hidden">
        {loading ? (
          <div className="card-pad fs12 fc-3">Chargement des sites…</div>
        ) : error ? (
          <div className="auth-error card-pad" role="alert">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌂</div>
            <h3>Aucun site</h3>
            <p>Créez votre premier entrepôt ou magasin de stockage.</p>
            {canManage ? (
              <button className="btn btn-gold mt8" type="button" onClick={() => onOpenModal("create")}>
                + Nouveau site
              </button>
            ) : null}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl wh-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Localisation</th>
                  <th>Capacité</th>
                  <th>Responsable</th>
                  <th>Horaires</th>
                  <th>Conditions</th>
                  <th>Zones</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.active ? "" : "cat-row-inactive"}>
                    <td>
                      <span className="ref-code">{row.code}</span>
                    </td>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>
                      <span className={`badge ${row.kindLabel === "Magasin" ? "badge-info" : "badge-navy"}`}>
                        {row.kindLabel}
                      </span>
                    </td>
                    <td>
                      {[row.city, row.address].filter(Boolean).join(" · ") || "—"}
                      {row.latitude != null && row.longitude != null ? (
                        <>
                          <br />
                          <a
                            className="fs11"
                            href={mapsUrl(row.latitude, row.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Voir sur la carte
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {row.totalCapacity != null
                        ? `${fmtNum(row.totalCapacity)} ${row.capacityUnit ?? ""}`.trim()
                        : "—"}
                    </td>
                    <td>
                      {row.managerName || "—"}
                      {row.managerPhone ? (
                        <>
                          <br />
                          <span className="fs11 fc-3">{row.managerPhone}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="fs12">{row.accessHours || "—"}</td>
                    <td>
                      {row.specialConditions.length > 0 ? (
                        <div className="wh-tags">
                          {row.specialConditions.slice(0, 3).map((tag) => (
                            <span key={tag} className="badge badge-navy">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-xs"
                        type="button"
                        onClick={() => onManageZones(row)}
                      >
                        Zones ({row.zoneCount ?? 0})
                      </button>
                    </td>
                    <td>
                      <span className={`badge ${row.active ? "badge-ok" : "badge-gray"}`}>
                        {row.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td>
                      {canManage ? (
                        <div className="row-actions">
                          <button
                            className="btn btn-outline btn-xs"
                            type="button"
                            onClick={() => onOpenModal("edit", row)}
                          >
                            Modifier
                          </button>{" "}
                          <button
                            className="btn btn-outline btn-xs"
                            type="button"
                            onClick={() => onToggleActive(row, !row.active)}
                          >
                            {row.active ? "Désactiver" : "Activer"}
                          </button>{" "}
                          <button
                            className="btn btn-danger btn-xs"
                            type="button"
                            onClick={() => onRequestDelete(row)}
                          >
                            Suppr.
                          </button>
                        </div>
                      ) : null}
                    </td>
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
