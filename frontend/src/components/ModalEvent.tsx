"use client";

type ModalEventProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalEvent({ isOpen, onClose, onSave }: ModalEventProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalEvent">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalEventTitle">
        <div className="modal-hd">
          <h2 id="modalEventTitle">Nouvel événement</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <input type="hidden" id="ev-id" />
          <div className="fg full">
            <label>Nom de l&apos;événement *</label>
            <input className="fi" id="ev-nom" placeholder="Ex : Gala NSIA 2025" />
          </div>
          <div className="fg full">
            <label>Client *</label>
            <input className="fi" id="ev-client" placeholder="Nom du client ou de l'organisation" />
          </div>
          <div className="fg">
            <label>Date de début *</label>
            <input className="fi" id="ev-debut" type="date" />
          </div>
          <div className="fg">
            <label>Date de fin</label>
            <input className="fi" id="ev-fin" type="date" />
          </div>
          <div className="fg full">
            <label>Lieu</label>
            <input className="fi" id="ev-lieu" placeholder="Adresse ou nom du lieu" />
          </div>
          <div className="fg">
            <label>Responsable</label>
            <select className="fs" id="ev-resp" aria-label="Responsable">
              <option value="">— Sélectionner —</option>
            </select>
          </div>
          <div className="fg">
            <label>Statut</label>
            <select className="fs" id="ev-statut" defaultValue="Planifié" aria-label="Statut">
              <option value="Planifié">Planifié</option>
              <option value="En préparation">En préparation</option>
              <option value="Prêt">Prêt</option>
              <option value="Terminé">Terminé</option>
              <option value="Annulé">Annulé</option>
            </select>
          </div>
          <div className="fg full">
            <label>Notes</label>
            <textarea
              className="ft"
              id="ev-notes"
              placeholder="Instructions spéciales, contacts…"
            />
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

