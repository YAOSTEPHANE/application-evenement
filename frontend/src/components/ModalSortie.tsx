"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

type ModalSortieProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalSortie({ isOpen, onClose, onSave }: ModalSortieProps) {
  return (
    <ModalRoot isOpen={isOpen} id="modalSortie">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalSortieTitle">
        <ModalHeader
          icon="movements"
          title="Enregistrer une sortie"
          subtitle="Sortie de stock · événement optionnel"
          onClose={onClose}
          titleId="modalSortieTitle"
        />
        <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="sortie-article">Article *</label>
              <select className="fs" id="sortie-article">
                <option value="">— Sélectionner —</option>
              </select>
            </div>
            <div className="fg">
              <label htmlFor="sortie-qty">Quantité *</label>
              <input className="fi" id="sortie-qty" type="number" min={1} defaultValue={1} />
            </div>
            <div className="fg full">
              <label htmlFor="sortie-event">Événement associé</label>
              <select className="fs" id="sortie-event">
                <option value="">— Aucun —</option>
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="sortie-note">Note</label>
              <input className="fi" id="sortie-note" placeholder="Optionnel" />
            </div>
          </div>
          <div id="sortie-dispo" className="form-helper" />
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Enregistrer la sortie
          </button>
        </div>
      </div>
    </ModalRoot>
  );
}
