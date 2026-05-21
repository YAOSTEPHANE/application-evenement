"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";
import { UI_ROLE_PROFILE_OPTIONS } from "@/lib/cdc-role-profiles";

type ModalUserProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSave?: () => void;
};

export function ModalUser({ isOpen, mode, onClose, onSave }: ModalUserProps) {
  const isEdit = mode === "edit";
  const title = isEdit ? "Modifier l'utilisateur" : "Ajouter un utilisateur";
  const saveLabel = isEdit ? "Enregistrer" : "Ajouter";

  return (
    <ModalRoot isOpen={isOpen} id="modalUser">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalUserTitle">
        <ModalHeader
          icon="users"
          title={title}
          subtitle="Compte, rôle et accès application"
          onClose={onClose}
          titleId="modalUserTitle"
        />

        <div className="modal-body">
          <div className="form-grid form-premium">
            <input type="hidden" id="usr-id" />
            <div className="fg full">
              <label htmlFor="usr-username">Nom d&apos;utilisateur *</label>
              <input
                className="fi"
                id="usr-username"
                placeholder="lettres, chiffres, . _ -"
                autoComplete="off"
              />
            </div>
            <div className="fg">
              <label htmlFor="usr-prenom">Prénom *</label>
              <input className="fi" id="usr-prenom" placeholder="Prénom" />
            </div>
            <div className="fg">
              <label htmlFor="usr-nom">Nom *</label>
              <input className="fi" id="usr-nom" placeholder="Nom" />
            </div>
            <div className="fg full">
              <label htmlFor="usr-email">Email *</label>
              <input
                className="fi"
                id="usr-email"
                type="email"
                placeholder="email@agence.ci"
              />
            </div>
            <div className="fg full">
              <label htmlFor="usr-role">Profil principal *</label>
              <select className="fs" id="usr-role" defaultValue="Administrateur">
                {UI_ROLE_PROFILE_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="form-hint" style={{ marginTop: 6 }}>
                Un seul profil par utilisateur — voir la liste des profils dans Validation → Droits.
              </p>
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
                  />
                </div>
                <div className="fg full">
                  <label htmlFor="usr-password2">Confirmer le mot de passe *</label>
                  <input
                    className="fi"
                    id="usr-password2"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </>
            ) : (
              <div className="fg full">
                <label htmlFor="usr-password-edit">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
                <input
                  className="fi"
                  id="usr-password-edit"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>
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
    </ModalRoot>
  );
}
