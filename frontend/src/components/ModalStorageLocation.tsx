"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { FormEvent, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import type {
  StorageLocationFormPayload,
  StorageLocationRow,
  StorageZoneRow,
  WarehouseRow,
} from "@/lib/stock/api";
import {
  formatSpecialConditionsLines,
  LOCATION_CODE_REGEX,
  proposeLocationCode,
  type StorageLocationFillStateUi,
} from "@/lib/storage-location-helpers";

const FILL_STATES: StorageLocationFillStateUi[] = ["Vide", "Partiellement plein", "Plein"];

export type StorageLocationPreset = {
  shelvingNodeId?: string | null;
  hierarchyCoordinate?: string | null;
  maxWeightKg?: number | null;
  accessHeightCm?: number | null;
  accessWidthCm?: number | null;
};

function emptyForm(
  warehouse: WarehouseRow,
  zone: StorageZoneRow,
  preset?: StorageLocationPreset | null,
): StorageLocationFormPayload {
  const coord = preset?.hierarchyCoordinate ?? "";
  return {
    warehouseId: warehouse.id,
    storageZoneId: zone.id,
    shelvingNodeId: preset?.shelvingNodeId ?? null,
    code: proposeLocationCode(warehouse.code, coord || null),
    label: "",
    hierarchyCoordinate: coord,
    latitude: warehouse.latitude ?? null,
    longitude: warehouse.longitude ?? null,
    maxWeightKg: preset?.maxWeightKg ?? null,
    maxVolumeM3: null,
    maxItemCount: null,
    fillState: "Vide",
    minTempC: null,
    maxTempC: null,
    humidityPercent: null,
    accessHeightCm: preset?.accessHeightCm ?? null,
    accessWidthCm: preset?.accessWidthCm ?? null,
    specialConditionsText: "",
    notes: "",
    active: true,
  };
}

function rowToForm(row: StorageLocationRow): StorageLocationFormPayload {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    storageZoneId: row.storageZoneId,
    shelvingNodeId: row.shelvingNodeId,
    code: row.code,
    label: row.label ?? "",
    hierarchyCoordinate: row.hierarchyCoordinate ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    maxWeightKg: row.maxWeightKg,
    maxVolumeM3: row.maxVolumeM3,
    maxItemCount: row.maxItemCount,
    fillState: row.fillStateLabel,
    minTempC: row.minTempC,
    maxTempC: row.maxTempC,
    humidityPercent: row.humidityPercent,
    accessHeightCm: row.accessHeightCm,
    accessWidthCm: row.accessWidthCm,
    specialConditionsText: formatSpecialConditionsLines(row.specialConditions),
    notes: row.notes ?? "",
    active: row.active,
  };
}

type ModalStorageLocationProps = {
  isOpen: boolean;
  warehouse: WarehouseRow;
  zone: StorageZoneRow;
  initial: StorageLocationRow | null;
  preset?: StorageLocationPreset | null;
  onClose: () => void;
  onSubmit: (payload: StorageLocationFormPayload) => void | Promise<void>;
};

export function ModalStorageLocation({
  isOpen,
  warehouse,
  zone,
  initial,
  preset,
  onClose,
  onSubmit,
}: ModalStorageLocationProps) {
  const [form, setForm] = useState<StorageLocationFormPayload>(() =>
    emptyForm(warehouse, zone, preset),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(initial ? rowToForm(initial) : emptyForm(warehouse, zone, preset));
    setBusy(false);
  }, [isOpen, initial, preset, warehouse, zone]);

  function patch<K extends keyof StorageLocationFormPayload>(
    key: K,
    value: StorageLocationFormPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const floatOrNull = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  const intOrNull = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!LOCATION_CODE_REGEX.test(form.code.trim().toUpperCase())) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        code: form.code.trim().toUpperCase(),
        label: form.label?.trim() ?? "",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalRoot isOpen={isOpen} id="modalStorageLocation">
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="location"
          title={initial ? "Modifier l'emplacement" : "Nouvel emplacement"}
          subtitle={`${zone.name} · ${zone.code}`}
          onClose={onClose}
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="loc-code">Code emplacement *</label>
              <input
                id="loc-code"
                className="fi mono"
                value={form.code}
                onChange={(e) => patch("code", e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-fill">État</label>
              <select
                id="loc-fill"
                className="fs"
                value={form.fillState}
                onChange={(e) => patch("fillState", e.target.value as StorageLocationFillStateUi)}
              >
                {FILL_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="loc-label">Libellé</label>
              <input
                id="loc-label"
                className="fi"
                value={form.label ?? ""}
                onChange={(e) => patch("label", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-coord">Coordonnée rayonnage</label>
              <input
                id="loc-coord"
                className="fi mono"
                placeholder="A-1-2-3"
                value={form.hierarchyCoordinate ?? ""}
                onChange={(e) => patch("hierarchyCoordinate", e.target.value.toUpperCase())}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-lat">Latitude GPS</label>
              <input
                id="loc-lat"
                className="fi"
                type="number"
                step="any"
                value={form.latitude ?? ""}
                onChange={(e) => patch("latitude", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-lng">Longitude GPS</label>
              <input
                id="loc-lng"
                className="fi"
                type="number"
                step="any"
                value={form.longitude ?? ""}
                onChange={(e) => patch("longitude", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-weight">Capacité poids (kg)</label>
              <input
                id="loc-weight"
                className="fi"
                type="number"
                min={0}
                step={0.1}
                value={form.maxWeightKg ?? ""}
                onChange={(e) => patch("maxWeightKg", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-vol">Capacité volume (m³)</label>
              <input
                id="loc-vol"
                className="fi"
                type="number"
                min={0}
                step={0.01}
                value={form.maxVolumeM3 ?? ""}
                onChange={(e) => patch("maxVolumeM3", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-items">Nb articles max</label>
              <input
                id="loc-items"
                className="fi"
                type="number"
                min={1}
                value={form.maxItemCount ?? ""}
                onChange={(e) => patch("maxItemCount", intOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-tmin">Temp. min (°C)</label>
              <input
                id="loc-tmin"
                className="fi"
                type="number"
                step={0.1}
                value={form.minTempC ?? ""}
                onChange={(e) => patch("minTempC", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-tmax">Temp. max (°C)</label>
              <input
                id="loc-tmax"
                className="fi"
                type="number"
                step={0.1}
                value={form.maxTempC ?? ""}
                onChange={(e) => patch("maxTempC", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-hum">Humidité (%)</label>
              <input
                id="loc-hum"
                className="fi"
                type="number"
                min={0}
                max={100}
                value={form.humidityPercent ?? ""}
                onChange={(e) => patch("humidityPercent", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-ah">Hauteur accès (cm)</label>
              <input
                id="loc-ah"
                className="fi"
                type="number"
                min={0}
                value={form.accessHeightCm ?? ""}
                onChange={(e) => patch("accessHeightCm", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="loc-aw">Largeur accès (cm)</label>
              <input
                id="loc-aw"
                className="fi"
                type="number"
                min={0}
                value={form.accessWidthCm ?? ""}
                onChange={(e) => patch("accessWidthCm", floatOrNull(e.target.value))}
              />
            </div>
            <div className="fg full">
              <label htmlFor="loc-cond">Conditions spéciales (une par ligne)</label>
              <textarea
                id="loc-cond"
                className="ft"
                rows={2}
                placeholder="Température contrôlée&#10;Humidité &lt; 60 %"
                value={form.specialConditionsText ?? ""}
                onChange={(e) => patch("specialConditionsText", e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="chk mt24">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => patch("active", e.target.checked)}
                />
                Emplacement actif
              </label>
            </div>
            <div className="fg full">
              <label htmlFor="loc-notes">Notes</label>
              <textarea
                id="loc-notes"
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
