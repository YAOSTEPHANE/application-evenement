"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

type ModalRetourProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalRetour({ isOpen, onClose, onSave }: ModalRetourProps) {
  return (
    <ModalRoot isOpen={isOpen} id="modalRetour">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalRetourTitle">
        <ModalHeader
          icon="movements"
          title="Enregistrer un retour"
          subtitle="Réintégration matériel · état au retour"
          onClose={onClose}
          titleId="modalRetourTitle"
        />
        <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="retour-article">Article *</label>
              <select className="fs" id="retour-article">
                <option value="">— Sélectionner —</option>
              </select>
            </div>
            <div className="fg">
              <label htmlFor="retour-qty">Quantité retournée *</label>
              <input className="fi" id="retour-qty" type="number" min={1} defaultValue={1} />
            </div>
            <div className="fg full">
              <label htmlFor="retour-event">Événement associé</label>
              <select className="fs" id="retour-event">
                <option value="">— Aucun —</option>
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="retour-etat">État au retour *</label>
              <select className="fs" id="retour-etat" defaultValue="Bon état">
                <option value="Bon état">Bon état</option>
                <option value="Endommagé">Endommagé</option>
                <option value="Perdu">Perdu</option>
                <option value="À réparer">À réparer</option>
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="retour-note">Note</label>
              <input className="fi" id="retour-note" placeholder="Détails sur l'état, remarques…" />
            </div>
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Enregistrer le retour
          </button>
        </div>
      </div>
    </ModalRoot>
  );
}
