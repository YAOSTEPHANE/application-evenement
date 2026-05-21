"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ShelvingLevel } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { ModalShelvingNode } from "@/components/ModalShelvingNode";
import {
  fetchShelvingNodes,
  saveShelvingNodeViaApi,
  toggleShelvingNodeActiveViaApi,
  type ShelvingNodeFormPayload,
  type ShelvingNodeRow,
  type StorageZoneRow,
  type WarehouseRow,
} from "@/lib/stock/api";
import { shelvingLevelBadgeClass } from "@/lib/shelving-helpers";

type ModalZoneShelvingProps = {
  isOpen: boolean;
  warehouse: WarehouseRow;
  zone: StorageZoneRow | null;
  canManage: boolean;
  reloadToken?: number;
  onClose: () => void;
  onRequestDelete: (node: ShelvingNodeRow) => void;
};

function indentPx(level: string): number {
  switch (level) {
    case "RACK":
      return 16;
    case "SHELF":
      return 32;
    case "BIN":
      return 48;
    default:
      return 0;
  }
}

export function ModalZoneShelving({
  isOpen,
  warehouse,
  zone,
  canManage,
  reloadToken = 0,
  onClose,
  onRequestDelete,
}: ModalZoneShelvingProps) {
  const [nodes, setNodes] = useState<ShelvingNodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShelvingNodeRow | null>(null);
  const [parentForCreate, setParentForCreate] = useState<ShelvingNodeRow | null>(null);

  const loadNodes = useCallback(async () => {
    if (!zone) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchShelvingNodes(warehouse.id, zone.id);
      setNodes(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les rayonnages");
      setNodes([]);
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
    setParentForCreate(null);
    void loadNodes();
  }, [isOpen, zone, loadNodes, reloadToken]);

  const canAddChild = useCallback((row: ShelvingNodeRow) => row.level !== "BIN", []);

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.coordinate.localeCompare(b.coordinate)),
    [nodes],
  );

  function openCreate(parent: ShelvingNodeRow | null) {
    setParentForCreate(parent);
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ShelvingNodeRow) {
    setEditing(row);
    setParentForCreate(null);
    setFormOpen(true);
  }

  if (!zone) {
    return null;
  }

  return (
    <>
      <ModalRoot isOpen={isOpen} id="modalZoneShelving">
        <div className="modal modal--form modal-xl" role="dialog" aria-modal="true">
          <ModalHeader
            icon="warehouse"
            title="Rayonnages / shelves"
            subtitle={`${zone.name} · ${zone.code} — Allée → Rack → Étagère → Emplacement`}
            onClose={onClose}
          />
          <div className="modal-body">
          {canManage ? (
            <div className="mb12">
              <button className="btn btn-gold btn-sm" type="button" onClick={() => openCreate(null)}>
                + Nouvelle allée
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
            ) : sortedNodes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">▤</div>
                <h3>Aucun rayonnage</h3>
                <p>Créez une allée, puis des racks, étagères et emplacements.</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Coordonnée</th>
                      <th>Niveau</th>
                      <th>Libellé</th>
                      <th>Type / Poids</th>
                      <th>Dimensions</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedNodes.map((node) => (
                      <tr key={node.id} className={node.active ? "" : "cat-row-inactive"}>
                        <td style={{ paddingLeft: `${12 + indentPx(node.level)}px` }}>
                          <span className="ref-code mono">{node.coordinate}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${shelvingLevelBadgeClass(node.level as ShelvingLevel)}`}
                          >
                            {node.levelLabel}
                          </span>
                        </td>
                        <td>{node.label || "—"}</td>
                        <td className="fs12">
                          {node.materialTypeLabel
                            ? node.materialTypeLabel
                            : node.weightCapacityKg != null
                              ? `${node.weightCapacityKg} kg`
                              : "—"}
                        </td>
                        <td className="fs12">{node.dimensionsLabel || "—"}</td>
                        <td>
                          <span className={`badge ${node.active ? "badge-ok" : "badge-gray"}`}>
                            {node.active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td>
                          {canManage ? (
                            <div className="row-actions">
                              {canAddChild(node) ? (
                                <>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    type="button"
                                    onClick={() => openCreate(node)}
                                  >
                                    + Enfant
                                  </button>{" "}
                                </>
                              ) : null}
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => openEdit(node)}
                              >
                                Modifier
                              </button>{" "}
                              <button
                                className="btn btn-outline btn-xs"
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await toggleShelvingNodeActiveViaApi(
                                        warehouse.id,
                                        zone.id,
                                        node.id,
                                        !node.active,
                                      );
                                      await loadNodes();
                                    } catch (e) {
                                      setError(
                                        e instanceof Error ? e.message : "Action impossible",
                                      );
                                    }
                                  })();
                                }}
                              >
                                {node.active ? "Désactiver" : "Activer"}
                              </button>{" "}
                              <button
                                className="btn btn-danger btn-xs"
                                type="button"
                                onClick={() => onRequestDelete(node)}
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

      <ModalShelvingNode
        isOpen={formOpen}
        warehouseId={warehouse.id}
        zoneId={zone.id}
        zoneName={zone.name}
        parent={editing ? null : parentForCreate}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setParentForCreate(null);
        }}
        onSubmit={async (payload: ShelvingNodeFormPayload) => {
          await saveShelvingNodeViaApi(payload);
          setFormOpen(false);
          setEditing(null);
          setParentForCreate(null);
          await loadNodes();
        }}
      />
    </>
  );
}
