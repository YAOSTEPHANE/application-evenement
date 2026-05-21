"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { StorageLocationFillState } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import {
  ModalStorageLocation,
  type StorageLocationPreset,
} from "@/components/ModalStorageLocation";
import {
  fetchStorageLocations,
  saveStorageLocationViaApi,
  toggleStorageLocationActiveViaApi,
  type StorageLocationFormPayload,
  type StorageLocationRow,
  type StorageZoneRow,
  type WarehouseRow,
} from "@/lib/stock/api";
import { fillStateBadgeClass } from "@/lib/storage-location-helpers";

type ModalZoneStorageLocationsProps = {
  isOpen: boolean;
  warehouse: WarehouseRow;
  zone: StorageZoneRow | null;
  canManage: boolean;
  reloadToken?: number;
  onClose: () => void;
  onRequestDelete: (location: StorageLocationRow) => void;
};

export function ModalZoneStorageLocations({
  isOpen,
  warehouse,
  zone,
  canManage,
  reloadToken = 0,
  onClose,
  onRequestDelete,
}: ModalZoneStorageLocationsProps) {
  const [rows, setRows] = useState<StorageLocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StorageLocationRow | null>(null);
  const [preset, setPreset] = useState<StorageLocationPreset | null>(null);

  const loadRows = useCallback(async () => {
    if (!zone) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStorageLocations(warehouse.id, zone.id);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les emplacements");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [warehouse.id, zone]);

  useEffect(() => {
    if (!isOpen || !zone) {
      return;
    }
    setFormOpen(false);
    setEditing(null);
    setPreset(null);
    void loadRows();
  }, [isOpen, zone, loadRows, reloadToken]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.code.localeCompare(b.code)), [rows]);

  function openCreate(p?: StorageLocationPreset | null) {
    setPreset(p ?? null);
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: StorageLocationRow) {
    setEditing(row);
    setPreset(null);
    setFormOpen(true);
  }

  if (!zone) {
    return null;
  }

  return (
    <>
      <ModalRoot isOpen={isOpen} id="modalZoneStorageLocations">
        <div className="modal modal--form modal-xl" role="dialog" aria-modal="true">
          <ModalHeader
            icon="location"
            title="Emplacements individuels"
            subtitle={`${zone.name} · ${zone.code} — code, GPS, capacité, état`}
            onClose={onClose}
          />
          <div className="modal-body">
          {canManage ? (
            <div className="mb12">
              <button className="btn btn-gold btn-sm" type="button" onClick={() => openCreate(null)}>
                + Nouvel emplacement
              </button>
            </div>
          ) : null}
          <div className="card card-overflow-hidden">
            {loading ? (
              <div className="card-pad fs12 fc-3">Chargement…</div>
            ) : error ? (
              <div className="auth-error card-pad" role="alert">
                {error}
              </div>
            ) : sorted.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📍</div>
                <h3>Aucun emplacement</h3>
                <p>Créez des emplacements avec code, capacité et coordonnées GPS.</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Coordonnée</th>
                      <th>État</th>
                      <th>Capacité</th>
                      <th>GPS</th>
                      <th>Conditions</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((loc) => (
                      <tr key={loc.id} className={loc.active ? "" : "cat-row-inactive"}>
                        <td>
                          <span className="ref-code mono">{loc.code}</span>
                        </td>
                        <td className="mono fs12">{loc.hierarchyCoordinate || "—"}</td>
                        <td>
                          <span
                            className={`badge ${fillStateBadgeClass(loc.fillState as StorageLocationFillState)}`}
                          >
                            {loc.fillStateLabel}
                          </span>
                        </td>
                        <td className="fs12">
                          {[
                            loc.maxWeightKg != null ? `${loc.maxWeightKg} kg` : null,
                            loc.maxVolumeM3 != null ? `${loc.maxVolumeM3} m³` : null,
                            loc.maxItemCount != null ? `${loc.maxItemCount} art.` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="fs12">
                          {loc.latitude != null && loc.longitude != null
                            ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
                            : "—"}
                        </td>
                        <td className="fs12">
                          {loc.specialConditions.length > 0
                            ? loc.specialConditions.slice(0, 2).join(", ")
                            : loc.minTempC != null || loc.maxTempC != null
                              ? `${loc.minTempC ?? "?"}–${loc.maxTempC ?? "?"} °C`
                              : "—"}
                        </td>
                        <td>
                          <span className={`badge ${loc.active ? "badge-ok" : "badge-gray"}`}>
                            {loc.active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td>
                          {canManage ? (
                            <div className="row-actions">
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => openEdit(loc)}
                              >
                                Modifier
                              </button>{" "}
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await toggleStorageLocationActiveViaApi(
                                        warehouse.id,
                                        zone.id,
                                        loc.id,
                                        !loc.active,
                                      );
                                      await loadRows();
                                    } catch (e) {
                                      setError(
                                        e instanceof Error ? e.message : "Action impossible",
                                      );
                                    }
                                  })();
                                }}
                              >
                                {loc.active ? "Désactiver" : "Activer"}
                              </button>{" "}
                              <button
                                className="btn btn-danger btn-xs"
                                type="button"
                                onClick={() => onRequestDelete(loc)}
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
          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </ModalRoot>

      <ModalStorageLocation
        isOpen={formOpen}
        warehouse={warehouse}
        zone={zone}
        initial={editing}
        preset={preset}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setPreset(null);
        }}
        onSubmit={async (payload: StorageLocationFormPayload) => {
          await saveStorageLocationViaApi(payload);
          setFormOpen(false);
          setEditing(null);
          setPreset(null);
          await loadRows();
        }}
      />
    </>
  );
}
