"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { StorageZoneType } from "@prisma/client";
import { FormEvent, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import type { StorageZoneFormPayload, StorageZoneRow, WarehouseRow } from "@/lib/stock/api";
import {
  proposeZoneCode,
  ZONE_CODE_REGEX,
  zoneTypeFromUi,
  type StorageZoneAccessUi,
  type StorageZoneTypeUi,
} from "@/lib/warehouse-zone-helpers";

const ZONE_TYPES: StorageZoneTypeUi[] = ["Réception", "Picking", "Rayonnage", "Retour"];
const ACCESS_TYPES: StorageZoneAccessUi[] = ["Libre", "Restreint"];

function emptyForm(warehouse: WarehouseRow): StorageZoneFormPayload {
  return {
    warehouseId: warehouse.id,
    name: "",
    code: proposeZoneCode(StorageZoneType.RECEPTION, warehouse.code),
    zoneType: "Réception",
    locationLabel: "",
    totalCapacity: null,
    capacityUnit: warehouse.capacityUnit ?? "unités",
    accessType: "Libre",
    notes: "",
    active: true,
  };
}

function rowToForm(row: StorageZoneRow): StorageZoneFormPayload {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    name: row.name,
    code: row.code,
    zoneType: row.zoneTypeLabel,
    locationLabel: row.locationLabel ?? "",
    totalCapacity: row.totalCapacity,
    capacityUnit: row.capacityUnit ?? "unités",
    accessType: row.accessTypeLabel,
    notes: row.notes ?? "",
    active: row.active,
  };
}

type ModalStorageZoneProps = {
  isOpen: boolean;
  warehouse: WarehouseRow;
  initial: StorageZoneRow | null;
  onClose: () => void;
  onSubmit: (payload: StorageZoneFormPayload) => void | Promise<void>;
};

export function ModalStorageZone({
  isOpen,
  warehouse,
  initial,
  onClose,
  onSubmit,
}: ModalStorageZoneProps) {
  const [form, setForm] = useState<StorageZoneFormPayload>(() => emptyForm(warehouse));
  const [codeManual, setCodeManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(initial ? rowToForm(initial) : emptyForm(warehouse));
    setCodeManual(Boolean(initial));
    setBusy(false);
  }, [isOpen, initial, warehouse]);

  useEffect(() => {
    if (!isOpen || codeManual || initial) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      code: proposeZoneCode(zoneTypeFromUi(prev.zoneType), warehouse.code),
    }));
  }, [form.zoneType, isOpen, codeManual, initial, warehouse.code]);

  function patch<K extends keyof StorageZoneFormPayload>(
    key: K,
    value: StorageZoneFormPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const intOrNull = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !ZONE_CODE_REGEX.test(form.code.trim().toUpperCase())) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalRoot isOpen={isOpen} id="modalStorageZone">
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="location"
          title={initial ? "Modifier la zone" : "Nouvelle zone de stockage"}
          subtitle={`${warehouse.name} · ${warehouse.code}`}
          onClose={onClose}
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="sz-name">Nom *</label>
              <input
                id="sz-name"
                className="fi"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                required
              />
            </div>
            <div className="fg">
              <label htmlFor="sz-code">Code zone *</label>
              <input
                id="sz-code"
                className="fi mono"
                value={form.code}
                onChange={(e) => {
                  setCodeManual(true);
                  patch("code", e.target.value.toUpperCase());
                }}
                required
              />
            </div>
            <div className="fg">
              <label htmlFor="sz-type">Type *</label>
              <select
                id="sz-type"
                className="fs"
                value={form.zoneType}
                onChange={(e) => patch("zoneType", e.target.value as StorageZoneTypeUi)}
              >
                {ZONE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="sz-location">Localisation dans l&apos;entrepôt</label>
              <input
                id="sz-location"
                className="fi"
                placeholder="Allée A · Rack 12 · Niveau 2"
                value={form.locationLabel ?? ""}
                onChange={(e) => patch("locationLabel", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="sz-capacity">Capacité</label>
              <input
                id="sz-capacity"
                className="fi"
                type="number"
                min={0}
                value={form.totalCapacity ?? ""}
                onChange={(e) => patch("totalCapacity", intOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="sz-cap-unit">Unité</label>
              <input
                id="sz-cap-unit"
                className="fi"
                value={form.capacityUnit ?? ""}
                onChange={(e) => patch("capacityUnit", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="sz-access">Type d&apos;accès *</label>
              <select
                id="sz-access"
                className="fs"
                value={form.accessType}
                onChange={(e) => patch("accessType", e.target.value as StorageZoneAccessUi)}
              >
                {ACCESS_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="chk mt24">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => patch("active", e.target.checked)}
                />
                Zone active
              </label>
            </div>
            <div className="fg full">
              <label htmlFor="sz-notes">Notes</label>
              <textarea
                id="sz-notes"
                className="ft"
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => patch("notes", e.target.value)}
              />
            </div>
          </div>
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-gold" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : initial ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </ModalRoot>
  );
}
