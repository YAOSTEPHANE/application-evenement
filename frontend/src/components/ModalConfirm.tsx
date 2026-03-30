"use client";

type ModalConfirmProps = {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
};

export function ModalConfirm({
  isOpen,
  title = "Confirmer",
  message = "",
  confirmLabel = "Supprimer",
  onClose,
  onConfirm,
}: ModalConfirmProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalConfirm">
      <div className="modal confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="modal-hd">
          <h2 id="confirm-title">{title}</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <p id="confirm-msg">{message}</p>
        <div className="modal-ft">
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-danger"
            id="confirm-ok-btn"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

