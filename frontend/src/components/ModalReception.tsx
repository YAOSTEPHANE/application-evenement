"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

type ModalReceptionProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalReception({ isOpen, onClose, onSave }: ModalReceptionProps) {
  return (
    <ModalRoot isOpen={isOpen} id="modalReception">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalReceptionTitle">
        <ModalHeader
          icon="package"
          title="Réception / ajustement stock"
          subtitle="Entrée de quantités en stock"
          onClose={onClose}
          titleId="modalReceptionTitle"
        />
        <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="reception-article">Article *</label>
              <select className="fs" id="reception-article" />
            </div>
            <div className="fg">
              <label htmlFor="reception-qty">Quantité reçue *</label>
              <input
                className="fi"
                id="reception-qty"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
            <div className="fg full">
              <label htmlFor="reception-note">Notes</label>
              <textarea className="ft" id="reception-note" placeholder="Bon de livraison, fournisseur…" />
            </div>
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Enregistrer
          </button>
        </div>
      </div>
    </ModalRoot>
  );
}
