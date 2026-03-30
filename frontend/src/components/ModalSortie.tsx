"use client";

type ModalSortieProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalSortie({ isOpen, onClose, onSave }: ModalSortieProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalSortie">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalSortieTitle">
        <div className="modal-hd">
          <h2 id="modalSortieTitle">Enregistrer une sortie</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <div className="fg">
            <label>Article *</label>
            <select className="fs" id="sortie-article" aria-label="Article">
              <option value="">— Sélectionner —</option>
            </select>
          </div>
          <div className="fg">
            <label>Quantité *</label>
            <input
              className="fi"
              id="sortie-qty"
              type="number"
              min={1}
              defaultValue={1}
              aria-label="Quantité"
            />
          </div>
          <div className="fg full">
            <label>Événement associé</label>
            <select className="fs" id="sortie-event" aria-label="Événement associé">
              <option value="">— Aucun —</option>
            </select>
          </div>
          <div className="fg full">
            <label>Note</label>
            <input className="fi" id="sortie-note" placeholder="Optionnel" />
          </div>
        </div>

        <div id="sortie-dispo" className="form-helper" />

        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Enregistrer la sortie
          </button>
        </div>
      </div>
    </div>
  );
}

