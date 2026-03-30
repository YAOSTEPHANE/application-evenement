"use client";

type ModalAffectProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalAffect({ isOpen, onClose, onSave }: ModalAffectProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalAffect">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalAffectTitle">
        <div className="modal-hd">
          <h2 id="modalAffectTitle">Affecter des articles</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div id="affect-ev-name" className="affect-event-name" />

        <div className="form-grid">
          <input type="hidden" id="affect-ev-id" />
          <div className="fg">
            <label>Article *</label>
            <select className="fs" id="affect-article" aria-label="Article" />
          </div>
          <div className="fg">
            <label>Quantité *</label>
            <input
              className="fi"
              id="affect-qty"
              type="number"
              min={1}
              defaultValue={1}
              aria-label="Quantité"
            />
          </div>
        </div>

        <div id="affect-dispo" className="form-helper" />

        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Affecter
          </button>
        </div>
      </div>
    </div>
  );
}

