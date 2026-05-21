"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { MovementReason, MovementType } from "@prisma/client";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { uiMovementSubjectToDirectingPrinciple } from "@/lib/cdc-directing-principle";
import {
  defaultReasonForType,
  MOVEMENT_REASON_LABELS,
  reasonsForMovementType,
  type MovementUiType,
} from "@/lib/movement-helpers";
import type { ReturnCondition } from "@/lib/stock/types";

export type StockMovementFormPayload = {
  movementType: MovementType;
  movementReason: MovementReason;
  artId: string;
  qty: number;
  evId?: string;
  note?: string;
  etat?: ReturnCondition;
  fromLocationId?: string;
  toLocationId?: string;
  countedQty?: number;
  cdcCorrection?: boolean;
  cdcCorrectionNote?: string;
};

type LocationOption = { id: string; label: string };

type ModalStockMovementProps = {
  isOpen: boolean;
  preset?: MovementUiType;
  articleOptions: Array<{ value: string; label: string }>;
  eventOptions: Array<{ value: string; label: string }>;
  locationOptions: LocationOption[];
  onClose: () => void;
  onSubmit: (payload: StockMovementFormPayload) => Promise<void>;
};

const UI_TO_TYPE: Record<MovementUiType, MovementType> = {
  Entrée: MovementType.INBOUND,
  Sortie: MovementType.OUTBOUND,
  Transfert: MovementType.TRANSFER,
  Ajustement: MovementType.ADJUSTMENT,
  "Perte/Casse": MovementType.LOSS,
  Retour: MovementType.RETURN,
};

const CATEGORY_OPTIONS: MovementUiType[] = [
  "Entrée",
  "Sortie",
  "Transfert",
  "Ajustement",
  "Perte/Casse",
];

const RETURN_CONDITIONS: ReturnCondition[] = ["Bon état", "Endommagé", "Perdu"];

export function ModalStockMovement({
  isOpen,
  preset = "Entrée",
  articleOptions,
  eventOptions,
  locationOptions,
  onClose,
  onSubmit,
}: ModalStockMovementProps) {
  const [category, setCategory] = useState<MovementUiType>(preset);
  const [reason, setReason] = useState<MovementReason>(defaultReasonForType(UI_TO_TYPE[preset]));
  const [artId, setArtId] = useState("");
  const [qty, setQty] = useState(1);
  const [evId, setEvId] = useState("");
  const [note, setNote] = useState("");
  const [etat, setEtat] = useState<ReturnCondition>("Bon état");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [countedQty, setCountedQty] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cdcCorrection, setCdcCorrection] = useState(false);
  const [cdcCorrectionNote, setCdcCorrectionNote] = useState("");

  const movementType = UI_TO_TYPE[category];
  const subjectToPrinciple = uiMovementSubjectToDirectingPrinciple(movementType, {
    toStorageLocationId: toLocationId || undefined,
    fromStorageLocationId: fromLocationId || undefined,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCategory(preset);
    const t = UI_TO_TYPE[preset];
    setReason(defaultReasonForType(t));
    setArtId("");
    setQty(1);
    setEvId("");
    setNote("");
    setEtat("Bon état");
    setFromLocationId("");
    setToLocationId("");
    setCountedQty(0);
    setCdcCorrection(false);
    setCdcCorrectionNote("");
  }, [isOpen, preset]);

  useEffect(() => {
    const reasons = reasonsForMovementType(movementType);
    if (!reasons.includes(reason)) {
      setReason(reasons[0] ?? defaultReasonForType(movementType));
    }
  }, [movementType, reason]);

  const reasonOptions = useMemo(() => reasonsForMovementType(movementType), [movementType]);

  const title = useMemo(() => {
    switch (category) {
      case "Entrée":
        return "Enregistrer une entrée";
      case "Sortie":
        return "Enregistrer une sortie";
      case "Transfert":
        return "Transfert interne";
      case "Ajustement":
        return "Ajustement inventaire";
      case "Perte/Casse":
        return "Perte / casse";
      default:
        return "Mouvement de stock";
    }
  }, [category]);

  const showEvent =
    movementType === MovementType.OUTBOUND &&
    (reason === MovementReason.EVENT || reason === MovementReason.RENTAL);
  const showReturnState =
    movementType === MovementType.RETURN || reason === MovementReason.CUSTOMER_RETURN;
  const showTransfer = movementType === MovementType.TRANSFER;
  const showAdjustment = movementType === MovementType.ADJUSTMENT;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!artId) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        movementType,
        movementReason: reason,
        artId,
        qty,
        evId: evId || undefined,
        note: note.trim() || undefined,
        etat: showReturnState ? etat : undefined,
        fromLocationId: fromLocationId || undefined,
        toLocationId: toLocationId || undefined,
        countedQty: showAdjustment ? countedQty : undefined,
        cdcCorrection: subjectToPrinciple && cdcCorrection ? true : undefined,
        cdcCorrectionNote:
          subjectToPrinciple && cdcCorrection ? cdcCorrectionNote.trim() || undefined : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <ModalRoot isOpen={true}>
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true">
        <ModalHeader
          icon="movements"
          title={title}
          subtitle="Mouvement de stock"
          onClose={onClose}
        />
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
          {subjectToPrinciple ? (
            <div className="fg full">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={cdcCorrection}
                  onChange={(e) => setCdcCorrection(e.target.checked)}
                />
                Correction d&apos;un dysfonctionnement (sans bon signé)
              </label>
              {cdcCorrection ? (
                <textarea
                  className="fi"
                  rows={2}
                  placeholder="Décrivez la régularisation (obligatoire)"
                  value={cdcCorrectionNote}
                  onChange={(e) => setCdcCorrectionNote(e.target.value)}
                />
              ) : null}
            </div>
          ) : null}
          <div className="form-grid form-premium">
                        <div className="fg full">
              <label>Type de mouvement</label>
              <select className="fs" value={category} onChange={(e) => setCategory(e.target.value as MovementUiType)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>Motif</label>
              <select className="fs" value={reason} onChange={(e) => setReason(e.target.value as MovementReason)}>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>{MOVEMENT_REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="fg full">
              <label>Article *</label>
              <select className="fs" required value={artId} onChange={(e) => setArtId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {articleOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>Quantité *</label>
              <input className="fi" type="number" min={1} required value={qty} onChange={(e) => setQty(Number.parseInt(e.target.value, 10) || 1)} />
            </div>
            {showEvent ? (
              <div className="fg full">
                <label>Événement</label>
                <select className="fs" value={evId} onChange={(e) => setEvId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {eventOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {showReturnState ? (
              <div className="fg">
                <label>État au retour</label>
                <select className="fs" value={etat} onChange={(e) => setEtat(e.target.value as ReturnCondition)}>
                  {RETURN_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {showTransfer ? (
              <>
                <div className="fg full">
                  <label>Emplacement source *</label>
                  <select className="fs" required value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {locationOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="fg full">
                  <label>Emplacement destination *</label>
                  <select className="fs" required value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {locationOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            {showAdjustment ? (
              <div className="fg">
                <label>Quantité comptée *</label>
                <input className="fi" type="number" min={0} required value={countedQty} onChange={(e) => setCountedQty(Number.parseInt(e.target.value, 10) || 0)} />
              </div>
            ) : null}
            <div className="fg full">
              <label>Notes</label>
              <textarea className="ft" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={onClose}>Annuler</button>
            <button className="btn btn-gold" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </ModalRoot>
  );
}
