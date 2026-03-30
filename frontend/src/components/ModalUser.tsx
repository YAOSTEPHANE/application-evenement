"use client";

type ModalUserProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSave?: () => void;
};

export function ModalUser({ isOpen, mode, onClose, onSave }: ModalUserProps) {
  const isEdit = mode === "edit";
  const title = isEdit ? "Modifier l’utilisateur" : "Ajouter un utilisateur";
  const saveLabel = isEdit ? "Enregistrer" : "Ajouter";

  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalUser">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalUserTitle">
        <div className="modal-hd">
          <h2 id="modalUserTitle">{title}</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-grid">
          <input type="hidden" id="usr-id" />
          <div className="fg full">
            <label htmlFor="usr-username">Nom d’utilisateur *</label>
            <input
              className="fi"
              id="usr-username"
              placeholder="lettres, chiffres, . _ -"
              autoComplete="off"
              aria-label="Nom d’utilisateur"
            />
          </div>
          <div className="fg">
            <label htmlFor="usr-prenom">Prénom *</label>
            <input className="fi" id="usr-prenom" placeholder="Prénom" aria-label="Prénom" />
          </div>
          <div className="fg">
            <label htmlFor="usr-nom">Nom *</label>
            <input className="fi" id="usr-nom" placeholder="Nom" aria-label="Nom" />
          </div>
          <div className="fg full">
            <label htmlFor="usr-email">Email *</label>
            <input
              className="fi"
              id="usr-email"
              type="email"
              placeholder="email@agence.ci"
              aria-label="Email"
            />
          </div>
          <div className="fg full">
            <label htmlFor="usr-role">Rôle *</label>
            <select className="fs" id="usr-role" defaultValue="Administrateur" aria-label="Rôle">
              <option value="Administrateur">Administrateur</option>
              <option value="Gestionnaire">Gestionnaire</option>
              <option value="Magasinier">Magasinier</option>
              <option value="Lecture seule">Lecture seule</option>
            </select>
          </div>

          {!isEdit ? (
            <>
              <div className="fg full">
                <label htmlFor="usr-password">Mot de passe * (min. 8 caractères)</label>
                <input
                  className="fi"
                  id="usr-password"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Mot de passe"
                />
              </div>
              <div className="fg full">
                <label htmlFor="usr-password-confirm">Confirmer le mot de passe *</label>
                <input
                  className="fi"
                  id="usr-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Confirmer le mot de passe"
                />
              </div>
            </>
          ) : (
            <>
              <div className="fg full">
                <label htmlFor="usr-new-password">Nouveau mot de passe (optionnel)</label>
                <input
                  className="fi"
                  id="usr-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Laisser vide pour ne pas changer"
                  aria-label="Nouveau mot de passe"
                />
              </div>
              <div className="fg full">
                <label htmlFor="usr-new-password-confirm">Confirmer le nouveau mot de passe</label>
                <input
                  className="fi"
                  id="usr-new-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Confirmer le nouveau mot de passe"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-gold" type="button" onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
