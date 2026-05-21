"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

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
    <ModalRoot isOpen={isOpen} id="modalConfirm">
      <div className="modal modal--form confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <ModalHeader icon="alert" title={title} onClose={onClose} titleId="confirm-title" />
        <div className="modal-body">
          <p id="confirm-msg" className="fs14" style={{ margin: 0, lineHeight: 1.55 }}>
            {message}
          </p>
        </div>
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
    </ModalRoot>
  );
}
