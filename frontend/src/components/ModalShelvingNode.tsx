"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ShelvingLevel } from "@prisma/client";
import { FormEvent, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import type { ShelvingNodeFormPayload, ShelvingNodeRow } from "@/lib/stock/api";
import {
  childLevelFor,
  SHELF_SEGMENT_REGEX,
  shelvingLevelFromUi,
  type ShelvingLevelUi,
  type ShelvingMaterialUi,
} from "@/lib/shelving-helpers";

const MATERIALS: ShelvingMaterialUi[] = ["Métal", "Bois", "Plastique"];

function levelUiFromPrisma(level: ShelvingLevel): ShelvingLevelUi {
  switch (level) {
    case ShelvingLevel.RACK:
      return "Rack";
    case ShelvingLevel.SHELF:
      return "Étagère";
    case ShelvingLevel.BIN:
      return "Emplacement";
    default:
      return "Allée";
  }
}

function emptyForm(
  warehouseId: string,
  zoneId: string,
  parent: ShelvingNodeRow | null,
): ShelvingNodeFormPayload {
  const levelUi =
    parent == null ? "Allée" : levelUiFromPrisma(childLevelFor(parent.level as ShelvingLevel));
  return {
    warehouseId,
    storageZoneId: zoneId,
    parentId: parent?.id ?? null,
    level: levelUi,
    code: "",
    label: "",
    materialType: levelUi === "Rack" ? "Métal" : null,
    weightCapacityKg: null,
    widthCm: null,
    heightCm: null,
    depthCm: null,
    notes: "",
    active: true,
  };
}

function rowToForm(row: ShelvingNodeRow, warehouseId: string): ShelvingNodeFormPayload {
  return {
    id: row.id,
    warehouseId,
    storageZoneId: row.storageZoneId,
    parentId: row.parentId,
    level: row.levelLabel,
    code: row.code,
    label: row.label ?? "",
    materialType: row.materialTypeLabel,
    weightCapacityKg: row.weightCapacityKg,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    depthCm: row.depthCm,
    notes: row.notes ?? "",
    active: row.active,
  };
}

type ModalShelvingNodeProps = {
  isOpen: boolean;
  warehouseId: string;
  zoneId: string;
  zoneName: string;
  parent: ShelvingNodeRow | null;
  initial: ShelvingNodeRow | null;
  onClose: () => void;
  onSubmit: (payload: ShelvingNodeFormPayload) => void | Promise<void>;
};

export function ModalShelvingNode({
  isOpen,
  warehouseId,
  zoneId,
  zoneName,
  parent,
  initial,
  onClose,
  onSubmit,
}: ModalShelvingNodeProps) {
  const [form, setForm] = useState<ShelvingNodeFormPayload>(() =>
    emptyForm(warehouseId, zoneId, parent),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(initial ? rowToForm(initial, warehouseId) : emptyForm(warehouseId, zoneId, parent));
    setBusy(false);
  }, [isOpen, initial, parent, warehouseId, zoneId]);

  const level = shelvingLevelFromUi(form.level);
  const isRack = level === ShelvingLevel.RACK;
  const isBin = level === ShelvingLevel.BIN;

  function patch<K extends keyof ShelvingNodeFormPayload>(
    key: K,
    value: ShelvingNodeFormPayload[K],
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!SHELF_SEGMENT_REGEX.test(form.code.trim().toUpperCase())) {
      return;
    }
    if (isRack && !form.materialType) {
      return;
    }
    if (isBin && (form.weightCapacityKg == null || form.weightCapacityKg <= 0)) {
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

  const title = initial
    ? `Modifier — ${form.level}`
    : parent
      ? `Nouveau ${form.level} sous ${parent.coordinate}`
      : `Nouvelle ${form.level}`;

  return (
    <ModalRoot isOpen={isOpen} id="modalShelvingNode">
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="warehouse"
          title={title}
          subtitle={
            parent
              ? `${zoneName} · parent ${parent.coordinate}`
              : zoneName
          }
          onClose={onClose}
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="sh-level">Niveau</label>
              <input id="sh-level" className="fi" value={form.level} readOnly disabled />
            </div>
            <div className="fg">
              <label htmlFor="sh-code">Segment *</label>
              <input
                id="sh-code"
                className="fi mono"
                placeholder={isBin ? "3" : "A"}
                value={form.code}
                onChange={(e) => patch("code", e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="fg full">
              <label htmlFor="sh-label">Libellé</label>
              <input
                id="sh-label"
                className="fi"
                value={form.label ?? ""}
                onChange={(e) => patch("label", e.target.value)}
              />
            </div>
            {isRack ? (
              <div className="fg full">
                <label htmlFor="sh-material">Type de rayonnage *</label>
                <select
                  id="sh-material"
                  className="fs"
                  value={form.materialType ?? "Métal"}
                  onChange={(e) => patch("materialType", e.target.value as ShelvingMaterialUi)}
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {isBin ? (
              <>
                <div className="fg">
                  <label htmlFor="sh-weight">Capacité poids (kg) *</label>
                  <input
                    id="sh-weight"
                    className="fi"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={form.weightCapacityKg ?? ""}
                    onChange={(e) => patch("weightCapacityKg", floatOrNull(e.target.value))}
                    required
                  />
                </div>
                <div className="fg">
                  <label htmlFor="sh-w">Largeur (cm)</label>
                  <input
                    id="sh-w"
                    className="fi"
                    type="number"
                    min={0}
                    step={1}
                    value={form.widthCm ?? ""}
                    onChange={(e) => patch("widthCm", floatOrNull(e.target.value))}
                  />
                </div>
                <div className="fg">
                  <label htmlFor="sh-h">Hauteur (cm)</label>
                  <input
                    id="sh-h"
                    className="fi"
                    type="number"
                    min={0}
                    step={1}
                    value={form.heightCm ?? ""}
                    onChange={(e) => patch("heightCm", floatOrNull(e.target.value))}
                  />
                </div>
                <div className="fg">
                  <label htmlFor="sh-d">Profondeur (cm)</label>
                  <input
                    id="sh-d"
                    className="fi"
                    type="number"
                    min={0}
                    step={1}
                    value={form.depthCm ?? ""}
                    onChange={(e) => patch("depthCm", floatOrNull(e.target.value))}
                  />
                </div>
              </>
            ) : null}
            <div className="fg">
              <label className="chk mt24">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => patch("active", e.target.checked)}
                />
                Actif
              </label>
            </div>
            <div className="fg full">
              <label htmlFor="sh-notes">Notes</label>
              <textarea
                id="sh-notes"
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
