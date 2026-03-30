"use client";

type ModalUserProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalUser({ isOpen, onClose, onSave }: ModalUserProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalUser">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalUserTitle">
        <div className="modal-hd">
          <h2 id="modalUserTitle">Ajouter un utilisateur</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <input type="hidden" id="usr-id" />
          <div className="fg">
            <label>Prénom *</label>
            <input className="fi" id="usr-prenom" placeholder="Prénom" aria-label="Prénom" />
          </div>
          <div className="fg">
            <label>Nom *</label>
            <input className="fi" id="usr-nom" placeholder="Nom" aria-label="Nom" />
          </div>
          <div className="fg full">
            <label>Email *</label>
            <input
              className="fi"
              id="usr-email"
              type="email"
              placeholder="email@agence.ci"
              aria-label="Email"
            />
          </div>
          <div className="fg full">
            <label>Rôle *</label>
            <select className="fs" id="usr-role" defaultValue="Administrateur" aria-label="Rôle">
              <option value="Administrateur">Administrateur</option>
              <option value="Gestionnaire">Gestionnaire</option>
              <option value="Magasinier">Magasinier</option>
              <option value="Lecture seule">Lecture seule</option>
            </select>
          </div>
        </div>

        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

