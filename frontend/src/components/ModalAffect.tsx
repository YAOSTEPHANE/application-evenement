"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

type ModalAffectProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalAffect({ isOpen, onClose, onSave }: ModalAffectProps) {
  return (
    <ModalRoot isOpen={isOpen} id="modalAffect">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalAffectTitle">
        <ModalHeader
          icon="events"
          title="Affecter des articles"
          subtitle="Réservation matériel pour une prestation"
          onClose={onClose}
          titleId="modalAffectTitle"
        />
        <div className="modal-body">
          <div id="affect-ev-name" className="affect-event-name" />
          <div className="form-grid form-premium">
            <input type="hidden" id="affect-ev-id" />
            <div className="fg full" id="affect-ev-picker">
              <label htmlFor="affect-ev-select">Événement *</label>
              <select className="fs" id="affect-ev-select" defaultValue="">
                <option value="">— Sélectionner un événement —</option>
              </select>
            </div>
            <div className="fg">
              <label htmlFor="affect-article">Article *</label>
              <select className="fs" id="affect-article" />
            </div>
            <div className="fg">
              <label htmlFor="affect-qty">Quantité *</label>
              <input className="fi" id="affect-qty" type="number" min={1} defaultValue={1} />
            </div>
          </div>
          <div id="affect-dispo" className="form-helper" />
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Affecter
          </button>
        </div>
      </div>
    </ModalRoot>
  );
}
