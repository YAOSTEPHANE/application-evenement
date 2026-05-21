"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { FormEvent, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import {
  formatSpecialConditionsLines,
  proposeWarehouseCode,
  WAREHOUSE_CODE_REGEX,
  type WarehouseKindUi,
} from "@/lib/warehouse-helpers";
import type { WarehouseFormPayload, WarehouseRow } from "@/lib/stock/api";

type ModalWarehouseProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initial: WarehouseRow | null;
  onClose: () => void;
  onSubmit: (payload: WarehouseFormPayload) => void | Promise<void>;
};

function emptyForm(): WarehouseFormPayload {
  return {
    name: "",
    code: "",
    kind: "Entrepôt",
    address: "",
    city: "",
    latitude: null,
    longitude: null,
    totalCapacity: null,
    capacityUnit: "unités",
    managerName: "",
    managerPhone: "",
    managerEmail: "",
    accessHours: "",
    specialConditionsText: "",
    notes: "",
    active: true,
  };
}

function rowToForm(row: WarehouseRow): WarehouseFormPayload {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kindLabel,
    address: row.address ?? "",
    city: row.city ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    totalCapacity: row.totalCapacity,
    capacityUnit: row.capacityUnit ?? "unités",
    managerName: row.managerName ?? "",
    managerPhone: row.managerPhone ?? "",
    managerEmail: row.managerEmail ?? "",
    accessHours: row.accessHours ?? "",
    specialConditionsText: formatSpecialConditionsLines(row.specialConditions),
    notes: row.notes ?? "",
    active: row.active,
  };
}

export function ModalWarehouse({ isOpen, mode, initial, onClose, onSubmit }: ModalWarehouseProps) {
  const [form, setForm] = useState<WarehouseFormPayload>(emptyForm);
  const [codeManual, setCodeManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(initial ? rowToForm(initial) : emptyForm());
    setCodeManual(mode === "edit");
    setBusy(false);
  }, [isOpen, initial, mode]);

  useEffect(() => {
    if (!isOpen || codeManual || mode === "edit") {
      return;
    }
    setForm((prev) => ({ ...prev, code: proposeWarehouseCode(prev.name) }));
  }, [form.name, isOpen, codeManual, mode]);

  function patch<K extends keyof WarehouseFormPayload>(key: K, value: WarehouseFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const numOrNull = (raw: string) => {
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
    if (!form.name.trim() || !WAREHOUSE_CODE_REGEX.test(form.code.trim().toUpperCase())) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalRoot isOpen={isOpen} id="modalWarehouse">
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true" aria-labelledby="modalWarehouseTitle">
        <ModalHeader
          icon="warehouse"
          title={mode === "edit" ? "Modifier le site" : "Nouvel entrepôt / magasin"}
          subtitle="Sites de stockage · GPS · capacité · accès"
          onClose={onClose}
          titleId="modalWarehouseTitle"
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <p className="form-section-title">Identification</p>
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="wh-name">Nom *</label>
              <input
                id="wh-name"
                className="fi"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                required
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-code">Code *</label>
              <input
                id="wh-code"
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
              <label htmlFor="wh-kind">Type *</label>
              <select
                id="wh-kind"
                className="fs"
                value={form.kind}
                onChange={(e) => patch("kind", e.target.value as WarehouseKindUi)}
              >
                <option value="Entrepôt">Entrepôt</option>
                <option value="Magasin">Magasin</option>
              </select>
            </div>
            <div className="fg">
              <label className="chk mt24">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => patch("active", e.target.checked)}
                />
                Site actif
              </label>
            </div>
          </div>

          <p className="form-section-title">Localisation</p>
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="wh-address">Adresse</label>
              <input
                id="wh-address"
                className="fi"
                value={form.address ?? ""}
                onChange={(e) => patch("address", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-city">Ville</label>
              <input
                id="wh-city"
                className="fi"
                value={form.city ?? ""}
                onChange={(e) => patch("city", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-lat">Latitude GPS</label>
              <input
                id="wh-lat"
                className="fi mono"
                type="number"
                step="any"
                min={-90}
                max={90}
                value={form.latitude ?? ""}
                onChange={(e) => patch("latitude", numOrNull(e.target.value))}
                placeholder="5.3599517"
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-lng">Longitude GPS</label>
              <input
                id="wh-lng"
                className="fi mono"
                type="number"
                step="any"
                min={-180}
                max={180}
                value={form.longitude ?? ""}
                onChange={(e) => patch("longitude", numOrNull(e.target.value))}
                placeholder="-4.0082563"
              />
            </div>
          </div>

          <p className="form-section-title">Capacité & accès</p>
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="wh-capacity">Capacité totale</label>
              <input
                id="wh-capacity"
                className="fi"
                type="number"
                min={0}
                value={form.totalCapacity ?? ""}
                onChange={(e) => patch("totalCapacity", intOrNull(e.target.value))}
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-cap-unit">Unité</label>
              <input
                id="wh-cap-unit"
                className="fi"
                value={form.capacityUnit ?? ""}
                onChange={(e) => patch("capacityUnit", e.target.value)}
                placeholder="unités, m², palettes…"
              />
            </div>
            <div className="fg full">
              <label htmlFor="wh-hours">Horaires d&apos;accès</label>
              <input
                id="wh-hours"
                className="fi"
                value={form.accessHours ?? ""}
                onChange={(e) => patch("accessHours", e.target.value)}
                placeholder="Lun–Ven 8h–18h, Sam 9h–13h"
              />
            </div>
            <div className="fg full">
              <label htmlFor="wh-conditions">Conditions spéciales (une par ligne)</label>
              <textarea
                id="wh-conditions"
                className="ft"
                rows={3}
                value={form.specialConditionsText ?? ""}
                onChange={(e) => patch("specialConditionsText", e.target.value)}
                placeholder={"Climatisé\nSécurisé 24h/24\nQuai de chargement"}
              />
            </div>
          </div>

          <p className="form-section-title">Responsable</p>
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="wh-manager">Nom du responsable</label>
              <input
                id="wh-manager"
                className="fi"
                value={form.managerName ?? ""}
                onChange={(e) => patch("managerName", e.target.value)}
              />
            </div>
            <div className="fg">
              <label htmlFor="wh-phone">Téléphone</label>
              <input
                id="wh-phone"
                className="fi"
                value={form.managerPhone ?? ""}
                onChange={(e) => patch("managerPhone", e.target.value)}
              />
            </div>
            <div className="fg full">
              <label htmlFor="wh-email">E-mail</label>
              <input
                id="wh-email"
                className="fi"
                type="email"
                value={form.managerEmail ?? ""}
                onChange={(e) => patch("managerEmail", e.target.value)}
              />
            </div>
            <div className="fg full">
              <label htmlFor="wh-notes">Notes</label>
              <textarea
                id="wh-notes"
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
              {busy ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </ModalRoot>
  );
}
