"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { ModalHeader } from "@/components/ModalHeader";

type ModalEventProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
};

export function ModalEvent({ isOpen, onClose, onSave }: ModalEventProps) {
  return (
    <ModalRoot isOpen={isOpen} id="modalEvent">
      <div className="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="modalEventTitle">
        <ModalHeader
          icon="events"
          title="Nouvel événement"
          subtitle="Prestation, client, dates et responsable"
          onClose={onClose}
          titleId="modalEventTitle"
        />
        <div className="modal-body">
          <div className="form-grid form-premium">
            <input type="hidden" id="ev-id" />
            <div className="fg full">
              <label htmlFor="ev-nom">Nom de l&apos;événement *</label>
              <input className="fi" id="ev-nom" placeholder="Ex : Gala NSIA 2025" />
            </div>
            <div className="fg full">
              <label htmlFor="ev-client">Client *</label>
              <input className="fi" id="ev-client" placeholder="Nom du client ou de l'organisation" />
            </div>
            <div className="fg">
              <label htmlFor="ev-debut">Date de début *</label>
              <input className="fi" id="ev-debut" type="date" />
            </div>
            <div className="fg">
              <label htmlFor="ev-fin">Date de fin</label>
              <input className="fi" id="ev-fin" type="date" />
            </div>
            <div className="fg full">
              <label htmlFor="ev-lieu">Lieu</label>
              <input className="fi" id="ev-lieu" placeholder="Adresse ou nom du lieu" />
            </div>
            <div className="fg">
              <label htmlFor="ev-resp">Responsable</label>
              <select className="fs" id="ev-resp" aria-label="Responsable">
                <option value="">— Sélectionner —</option>
              </select>
            </div>
            <div className="fg">
              <label htmlFor="ev-statut">Statut</label>
              <select className="fs" id="ev-statut" defaultValue="Planifié" aria-label="Statut">
                <option value="Planifié">Planifié</option>
                <option value="En préparation">En préparation</option>
                <option value="Prêt">Prêt</option>
                <option value="Terminé">Terminé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="ev-notes">Notes</label>
              <textarea
                className="ft"
                id="ev-notes"
                placeholder="Instructions spéciales, contacts…"
              />
            </div>
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
    </ModalRoot>
  );
}
