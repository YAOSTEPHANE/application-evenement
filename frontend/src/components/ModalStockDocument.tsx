"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { useCallback, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  BE_SUBTYPE_LABELS,
  BS_SUBTYPE_LABELS,
  BT_SUBTYPE_LABELS,
  DOC_KIND_LABELS,
} from "@/lib/cdc-labels";

type WarehouseOption = { id: string; label: string };
type EventOption = { id: string; label: string };
type ItemOption = { id: string; label: string };

type ModalStockDocumentProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  warehouses: WarehouseOption[];
  events: EventOption[];
  items: ItemOption[];
  defaultEventId?: string;
  preset?: {
    kind?: "BE" | "BS" | "BT";
    beSubtype?: keyof typeof BE_SUBTYPE_LABELS;
    bsSubtype?: keyof typeof BS_SUBTYPE_LABELS;
    eventId?: string;
    toWarehouseId?: string;
    fromWarehouseId?: string;
  };
};

const BE_KEYS = Object.keys(BE_SUBTYPE_LABELS) as Array<keyof typeof BE_SUBTYPE_LABELS>;
const BS_KEYS = Object.keys(BS_SUBTYPE_LABELS) as Array<keyof typeof BS_SUBTYPE_LABELS>;
const BT_KEYS = Object.keys(BT_SUBTYPE_LABELS) as Array<keyof typeof BT_SUBTYPE_LABELS>;

export function ModalStockDocument({
  isOpen,
  onClose,
  onCreated,
  warehouses,
  events,
  items,
  defaultEventId = "",
  preset,
}: ModalStockDocumentProps) {
  const [kind, setKind] = useState<"BE" | "BS" | "BT">("BS");
  const [beSubtype, setBeSubtype] = useState(BE_KEYS[1]);
  const [bsSubtype, setBsSubtype] = useState<keyof typeof BS_SUBTYPE_LABELS>("BS_EVT");
  const [btSubtype, setBtSubtype] = useState(BT_KEYS[0]);
  const [eventId, setEventId] = useState(defaultEventId);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [tagCode, setTagCode] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setEventId(preset?.eventId ?? defaultEventId);
      if (preset?.kind) setKind(preset.kind);
      if (preset?.beSubtype) setBeSubtype(preset.beSubtype);
      if (preset?.bsSubtype) setBsSubtype(preset.bsSubtype);
      if (preset?.toWarehouseId) setToWarehouseId(preset.toWarehouseId);
      if (preset?.fromWarehouseId) setFromWarehouseId(preset.fromWarehouseId);
      setError("");
    }
  }, [isOpen, defaultEventId, preset]);

  const submit = useCallback(async () => {
    if (!itemId) {
      setError("Sélectionnez un article.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let trackedAssetId: string | undefined;
      if (tagCode.trim()) {
        const tagRes = await fetch("/api/rfid-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagCode: tagCode.trim().toUpperCase(),
            itemId,
            rfidTagType: "ADHESIVE",
            currentWarehouseId: fromWarehouseId || undefined,
          }),
        });
        if (tagRes.ok) {
          const tag = await tagRes.json();
          trackedAssetId = tag.id;
        } else if (tagRes.status !== 409) {
          const err = await tagRes.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? "Tag RFID invalide");
        } else {
          const list = await fetch(`/api/rfid-tags?q=${encodeURIComponent(tagCode.trim())}`);
          const assets = await list.json();
          trackedAssetId = assets[0]?.id;
        }
      }

      const body: Record<string, unknown> = {
        kind,
        eventId: eventId || undefined,
        fromWarehouseId: fromWarehouseId || undefined,
        toWarehouseId: toWarehouseId || undefined,
        lines: [{ itemId, trackedAssetId, expectedQty: qty }],
      };
      if (kind === "BE") body.beSubtype = beSubtype;
      if (kind === "BS") body.bsSubtype = bsSubtype;
      if (kind === "BT") body.btSubtype = btSubtype;

      const res = await fetch("/api/stock-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Création impossible");
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }, [
    beSubtype,
    bsSubtype,
    btSubtype,
    eventId,
    fromWarehouseId,
    itemId,
    kind,
    onClose,
    onCreated,
    qty,
    tagCode,
    toWarehouseId,
  ]);

  return (
    <ModalRoot isOpen={isOpen}>
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="documents"
          title={`Nouveau bon — ${DOC_KIND_LABELS[kind]}`}
          subtitle="Création rapide — mouvement de matériel"
          onClose={onClose}
        />
        <div className="modal-body">
        <div className="form-grid form-premium">
          <div className="fg full">
            <label>Type de bon</label>
            <select className="fs" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="BE">{DOC_KIND_LABELS.BE}</option>
              <option value="BS">{DOC_KIND_LABELS.BS}</option>
              <option value="BT">{DOC_KIND_LABELS.BT}</option>
            </select>
          </div>
          {kind === "BE" ? (
            <div className="fg full">
              <label>Sous-type BE</label>
              <select className="fs" value={beSubtype} onChange={(e) => setBeSubtype(e.target.value as typeof beSubtype)}>
                {BE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BE_SUBTYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === "BS" ? (
            <div className="fg full">
              <label>Sous-type BS</label>
              <select className="fs" value={bsSubtype} onChange={(e) => setBsSubtype(e.target.value as typeof bsSubtype)}>
                {BS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BS_SUBTYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === "BT" ? (
            <div className="fg full">
              <label>Sous-type BT</label>
              <select className="fs" value={btSubtype} onChange={(e) => setBtSubtype(e.target.value as typeof btSubtype)}>
                {BT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BT_SUBTYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="fg full">
            <label>Commande / événement</label>
            <select className="fs" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— Optionnel —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Entrepôt source</label>
            <select className="fs" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Entrepôt destination</label>
            <select className="fs" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg full">
            <label>Article *</label>
            <select className="fs" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Tag RFID (optionnel)</label>
            <input
              className="fi"
              placeholder="TAG-MOB-0001"
              value={tagCode}
              onChange={(e) => setTagCode(e.target.value)}
            />
          </div>
          <div className="fg">
            <label>Quantité</label>
            <input
              className="fi"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number.parseInt(e.target.value, 10) || 1)}
            />
          </div>
          {error ? (
            <div className="fg full auth-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        </div>
        <div className="modal-ft">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-gold btn-icon" disabled={saving} onClick={() => void submit()}>
            <AppIcon name="plus" size={14} />
            {saving ? "Création…" : "Créer le bon"}
          </button>
        </div>
      </div>
    </ModalRoot>
  );
}
