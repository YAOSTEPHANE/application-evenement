"use client";

type ModalRetourProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalRetour({ isOpen, onClose, onSave }: ModalRetourProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalRetour">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalRetourTitle">
        <div className="modal-hd">
          <h2 id="modalRetourTitle">Enregistrer un retour</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <div className="fg">
            <label>Article *</label>
            <select className="fs" id="retour-article" aria-label="Article">
              <option value="">— Sélectionner —</option>
            </select>
          </div>
          <div className="fg">
            <label>Quantité retournée *</label>
            <input
              className="fi"
              id="retour-qty"
              type="number"
              min={1}
              defaultValue={1}
              aria-label="Quantité retournée"
            />
          </div>
          <div className="fg full">
            <label>Événement associé</label>
            <select className="fs" id="retour-event" aria-label="Événement associé">
              <option value="">— Aucun —</option>
            </select>
          </div>
          <div className="fg full">
            <label>État au retour *</label>
            <select className="fs" id="retour-etat" defaultValue="Bon état" aria-label="État au retour">
              <option value="Bon état">Bon état</option>
              <option value="Endommagé">Endommagé</option>
              <option value="Perdu">Perdu</option>
              <option value="À réparer">À réparer</option>
            </select>
          </div>
          <div className="fg full">
            <label>Note</label>
            <input
              className="fi"
              id="retour-note"
              placeholder="Détails sur l'état, remarques…"
            />
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
    </div>
  );
}

