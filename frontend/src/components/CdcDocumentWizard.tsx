"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import { DOC_KIND_LABELS } from "@/lib/cdc-labels";
import { getWizardConfig, listWizardPresets, type DocumentWizardConfig } from "@/lib/cdc-wizard-config";
import { clientFetch } from "@/lib/stock/api";

type WarehouseOption = { id: string; label: string };
type EventOption = { id: string; label: string };
type ItemOption = { id: string; label: string };

type CdcDocumentWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  warehouses: WarehouseOption[];
  events: EventOption[];
  items: ItemOption[];
  initialKind?: "BE" | "BS" | "BT";
  initialSubtype?: string;
};

export function CdcDocumentWizard({
  isOpen,
  onClose,
  onCreated,
  warehouses,
  events,
  items,
  initialKind = "BS",
  initialSubtype = "BS_EVT",
}: CdcDocumentWizardProps) {
  const presets = useMemo(() => listWizardPresets(), []);
  const [kind, setKind] = useState<"BE" | "BS" | "BT">(initialKind);
  const [subtype, setSubtype] = useState(initialSubtype);
  const [stepIndex, setStepIndex] = useState(0);
  const [eventId, setEventId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [tagCode, setTagCode] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const config: DocumentWizardConfig | undefined = useMemo(
    () => getWizardConfig(kind, subtype),
    [kind, subtype],
  );

  useEffect(() => {
    if (isOpen) {
      setKind(initialKind);
      setSubtype(initialSubtype);
      setStepIndex(0);
      setError("");
    }
  }, [isOpen, initialKind, initialSubtype]);

  useEffect(() => {
    if (!isOpen || warehouses.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await clientFetch("/api/settings");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        organization?: { settings?: { defaultWarehouseId?: string | null } };
      };
      const defaultId = data.organization?.settings?.defaultWarehouseId;
      if (!defaultId || !warehouses.some((w) => w.id === defaultId)) return;
      if (cancelled) return;
      setFromWarehouseId((prev) => prev || defaultId);
      if (kind === "BT") {
        setToWarehouseId((prev) => prev || "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, warehouses, kind]);

  const step = config?.steps[stepIndex];

  const submit = useCallback(async () => {
    if (!itemId || !config) {
      setError("Complétez les champs obligatoires.");
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
          trackedAssetId = ((await tagRes.json()) as { id: string }).id;
        } else if (tagRes.status === 409) {
          const list = await fetch(`/api/rfid-tags?q=${encodeURIComponent(tagCode.trim())}`);
          const assets = (await list.json()) as Array<{ id: string }>;
          trackedAssetId = assets[0]?.id;
        }
      }
      const body: Record<string, unknown> = {
        kind,
        eventId: eventId || undefined,
        fromWarehouseId: fromWarehouseId || undefined,
        toWarehouseId: toWarehouseId || undefined,
        notes: notes || undefined,
        photoUrls: photoDataUrls.length > 0 ? photoDataUrls : undefined,
        lines: [{ itemId, trackedAssetId, expectedQty: qty }],
      };
      if (kind === "BE") body.beSubtype = subtype;
      if (kind === "BS") body.bsSubtype = subtype;
      if (kind === "BT") body.btSubtype = subtype;
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
    config,
    eventId,
    fromWarehouseId,
    itemId,
    kind,
    notes,
    onClose,
    onCreated,
    qty,
    subtype,
    tagCode,
    toWarehouseId,
    photoDataUrls,
  ]);

  function onPhotoPick(file: File | null) {
    if (!file || photoDataUrls.length >= 4) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (typeof url === "string") {
        setPhotoDataUrls((prev) => [...prev, url].slice(0, 4));
      }
    };
    reader.readAsDataURL(file);
  }

  if (!isOpen) return null;

  return (
    <ModalRoot isOpen={true}>
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="documents"
          title={`Assistant bon — ${config?.label ?? DOC_KIND_LABELS[kind]}`}
          subtitle={step?.description ?? config?.label ?? "Assistant guidé CDC"}
          onClose={onClose}
        />
        <div className="modal-body">
        {config ? (
          <div className="cdc-wizard-steps" aria-label="Étapes">
            {config.steps.map((s, i) => (
              <span
                key={s.id}
                className={`cdc-wizard-step${i === stepIndex ? " cdc-wizard-step--active" : ""}${i < stepIndex ? " cdc-wizard-step--done" : ""}`}
              >
                {i < stepIndex ? "✓ " : ""}
                {s.title}
              </span>
            ))}
          </div>
        ) : null}
        <div className="form-grid form-premium">
          <div className="fg full">
            <label>Type CDC</label>
            <select
              className="fs"
              value={`${kind}:${subtype}`}
              onChange={(e) => {
                const [k, s] = e.target.value.split(":");
                setKind(k as "BE" | "BS" | "BT");
                setSubtype(s);
                setStepIndex(0);
              }}
            >
              {presets.map((p) => (
                <option key={`${p.kind}:${p.subtype}`} value={`${p.kind}:${p.subtype}`}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {step ? (
            <div className="fg full">
              <p className="fw600 fs14">{step.title}</p>
              <p className="fs12 text-muted" style={{ marginBottom: 12 }}>
                {step.description} — Étape {stepIndex + 1}/{config?.steps.length ?? 1}
              </p>
            </div>
          ) : null}
          {step?.fields.includes("event") ? (
            <div className="fg full">
              <label>Événement *</label>
              <select className="fs" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">—</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {step?.fields.includes("fromWarehouse") ? (
            <div className="fg">
              <label>Source</label>
              <select className="fs" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
                <option value="">—</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {step?.fields.includes("toWarehouse") ? (
            <div className="fg">
              <label>Destination</label>
              <select className="fs" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                <option value="">—</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {step?.fields.includes("item") ? (
            <div className="fg full">
              <label>Article *</label>
              <select className="fs" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">—</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {step?.fields.includes("tag") ? (
            <div className="fg">
              <label>Tag RFID</label>
              <input className="fi" value={tagCode} onChange={(e) => setTagCode(e.target.value)} />
            </div>
          ) : null}
          {step?.fields.includes("qty") ? (
            <div className="fg">
              <label>Qté</label>
              <input
                className="fi"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number.parseInt(e.target.value, 10) || 1)}
              />
            </div>
          ) : null}
          {step?.fields.includes("notes") ? (
            <div className="fg full">
              <label>Notes</label>
              <textarea className="fi" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : null}
          {step?.fields.includes("photo") ? (
            <div className="fg full">
              <label>Photos (anomalies / dommages)</label>
              <input
                className="fi"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPhotoPick(e.target.files?.[0] ?? null)}
              />
              {photoDataUrls.length > 0 ? (
                <p className="fs12 text-muted">{photoDataUrls.length} photo(s) jointe(s)</p>
              ) : null}
            </div>
          ) : null}
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
          {stepIndex > 0 ? (
            <button type="button" className="btn btn-outline" onClick={() => setStepIndex((i) => i - 1)}>
              Précédent
            </button>
          ) : null}
          {config && stepIndex < config.steps.length - 1 ? (
            <button type="button" className="btn btn-gold btn-icon" onClick={() => setStepIndex((i) => i + 1)}>
              Suivant
              <AppIcon name="chevronLeft" size={14} style={{ transform: "rotate(180deg)" }} />
            </button>
          ) : (
            <button type="button" className="btn btn-gold btn-icon" disabled={saving} onClick={() => void submit()}>
              <AppIcon name="check" size={14} />
              {saving ? "Création…" : "Créer le bon"}
            </button>
          )}
        </div>
      </div>
    </ModalRoot>
  );
}
