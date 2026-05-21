"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { useCallback, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { ModalStorageZone } from "@/components/ModalStorageZone";
import { ModalZoneShelving } from "@/components/ModalZoneShelving";
import { ModalZoneStorageLocations } from "@/components/ModalZoneStorageLocations";
import {
  deleteStorageZoneViaApi,
  fetchStorageZones,
  saveStorageZoneViaApi,
  toggleStorageZoneActiveViaApi,
  type ShelvingNodeRow,
  type StorageLocationRow,
  type StorageZoneFormPayload,
  type StorageZoneRow,
  type WarehouseRow,
} from "@/lib/stock/api";
import { fmtNum } from "@/lib/stock/helpers";
import { zoneTypeBadgeClass } from "@/lib/warehouse-zone-helpers";
import { StorageZoneType } from "@prisma/client";

type ModalWarehouseZonesProps = {
  isOpen: boolean;
  warehouse: WarehouseRow | null;
  canManage: boolean;
  onClose: () => void;
  onZonesChanged: () => void;
  onRequestDelete: (zone: StorageZoneRow) => void;
  onRequestDeleteShelving: (zone: StorageZoneRow, node: ShelvingNodeRow) => void;
  onRequestDeleteLocation: (zone: StorageZoneRow, location: StorageLocationRow) => void;
  shelvingReloadToken?: number;
  locationsReloadToken?: number;
};

export function ModalWarehouseZones({
  isOpen,
  warehouse,
  canManage,
  onClose,
  onZonesChanged,
  onRequestDelete,
  onRequestDeleteShelving,
  onRequestDeleteLocation,
  shelvingReloadToken = 0,
  locationsReloadToken = 0,
}: ModalWarehouseZonesProps) {
  const [zones, setZones] = useState<StorageZoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [zoneEditing, setZoneEditing] = useState<StorageZoneRow | null>(null);
  const [shelvingOpen, setShelvingOpen] = useState(false);
  const [zoneForShelving, setZoneForShelving] = useState<StorageZoneRow | null>(null);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [zoneForLocations, setZoneForLocations] = useState<StorageZoneRow | null>(null);

  const loadZones = useCallback(async () => {
    if (!warehouse) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStorageZones(warehouse.id);
      setZones(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les zones");
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, [warehouse]);

  useEffect(() => {
    if (!isOpen || !warehouse) {
      return;
    }
    setZoneFormOpen(false);
    setZoneEditing(null);
    setShelvingOpen(false);
    setZoneForShelving(null);
    setLocationsOpen(false);
    setZoneForLocations(null);
    void loadZones();
  }, [isOpen, warehouse, loadZones]);

  function openZoneForm(row?: StorageZoneRow) {
    setZoneEditing(row ?? null);
    setZoneFormOpen(true);
  }

  if (!warehouse) {
    return null;
  }

  return (
    <>
      <ModalRoot isOpen={isOpen} id="modalWarehouseZones">
        <div className="modal modal--form modal-xl" role="dialog" aria-modal="true">
          <ModalHeader
            icon="warehouse"
            title="Zones de stockage"
            subtitle={`${warehouse.name} · ${warehouse.code}`}
            onClose={onClose}
          />
          <div className="modal-body">
          {canManage ? (
            <div className="mb12">
              <button className="btn btn-gold btn-sm" type="button" onClick={() => openZoneForm()}>
                + Nouvelle zone
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
            ) : zones.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">▦</div>
                <h3>Aucune zone</h3>
                <p>Définissez des zones réception, picking, rayonnage ou retour.</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Nom</th>
                      <th>Type</th>
                      <th>Emplacement</th>
                      <th>Capacité</th>
                      <th>Accès</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((zone) => (
                      <tr key={zone.id} className={zone.active ? "" : "cat-row-inactive"}>
                        <td>
                          <span className="ref-code">{zone.code}</span>
                        </td>
                        <td>
                          <strong>{zone.name}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${zoneTypeBadgeClass(zone.zoneType as StorageZoneType)}`}
                          >
                            {zone.zoneTypeLabel}
                          </span>
                        </td>
                        <td className="fs12">{zone.locationLabel || "—"}</td>
                        <td>
                          {zone.totalCapacity != null
                            ? `${fmtNum(zone.totalCapacity)} ${zone.capacityUnit ?? ""}`.trim()
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              zone.accessTypeLabel === "Restreint" ? "badge-warn" : "badge-ok"
                            }`}
                          >
                            {zone.accessTypeLabel}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${zone.active ? "badge-ok" : "badge-gray"}`}>
                            {zone.active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td>
                          {canManage ? (
                            <div className="row-actions">
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => {
                                  setZoneForLocations(zone);
                                  setLocationsOpen(true);
                                }}
                              >
                                Emplacements ({zone.locationCount ?? 0})
                              </button>{" "}
                              {zone.zoneType === StorageZoneType.SHELVING ? (
                                <>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    type="button"
                                    onClick={() => {
                                      setZoneForShelving(zone);
                                      setShelvingOpen(true);
                                    }}
                                  >
                                    Rayonnages ({zone.shelvingCount ?? 0})
                                  </button>{" "}
                                </>
                              ) : null}
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => openZoneForm(zone)}
                              >
                                Modifier
                              </button>{" "}
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await toggleStorageZoneActiveViaApi(
                                        warehouse.id,
                                        zone.id,
                                        !zone.active,
                                      );
                                      await loadZones();
                                      onZonesChanged();
                                    } catch (e) {
                                      setError(
                                        e instanceof Error ? e.message : "Action impossible",
                                      );
                                    }
                                  })();
                                }}
                              >
                                {zone.active ? "Désactiver" : "Activer"}
                              </button>{" "}
                              <button
                                className="btn btn-danger btn-xs"
                                type="button"
                                onClick={() => onRequestDelete(zone)}
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

      <ModalStorageZone
        isOpen={zoneFormOpen}
        warehouse={warehouse}
        initial={zoneEditing}
        onClose={() => {
          setZoneFormOpen(false);
          setZoneEditing(null);
        }}
        onSubmit={async (payload: StorageZoneFormPayload) => {
          await saveStorageZoneViaApi(payload);
          setZoneFormOpen(false);
          setZoneEditing(null);
          await loadZones();
          onZonesChanged();
        }}
      />
      <ModalZoneShelving
        isOpen={shelvingOpen}
        warehouse={warehouse}
        zone={zoneForShelving}
        canManage={canManage}
        reloadToken={shelvingReloadToken}
        onClose={() => {
          setShelvingOpen(false);
          setZoneForShelving(null);
          void loadZones();
        }}
        onRequestDelete={(node) => {
          if (zoneForShelving) {
            onRequestDeleteShelving(zoneForShelving, node);
          }
        }}
      />
      <ModalZoneStorageLocations
        isOpen={locationsOpen}
        warehouse={warehouse}
        zone={zoneForLocations}
        canManage={canManage}
        reloadToken={locationsReloadToken}
        onClose={() => {
          setLocationsOpen(false);
          setZoneForLocations(null);
          void loadZones();
        }}
        onRequestDelete={(location) => {
          if (zoneForLocations) {
            onRequestDeleteLocation(zoneForLocations, location);
          }
        }}
      />
    </>
  );
}
