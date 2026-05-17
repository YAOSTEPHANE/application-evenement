"use client";

type ModalReceptionProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalReception({ isOpen, onClose, onSave }: ModalReceptionProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalReception">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalReceptionTitle">
        <div className="modal-hd">
          <h2 id="modalReceptionTitle">Réception / ajustement stock</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <div className="fg full">
            <label>Article *</label>
            <select className="fs" id="reception-article" aria-label="Article" />
          </div>
          <div className="fg">
            <label>Quantité reçue *</label>
            <input
              className="fi"
              id="reception-qty"
              type="number"
              min={1}
              defaultValue={1}
              aria-label="Quantité"
            />
          </div>
          <div className="fg full">
            <label>Notes</label>
            <textarea className="ft" id="reception-note" placeholder="Bon de livraison, fournisseur…" />
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
    </div>
  );
}
