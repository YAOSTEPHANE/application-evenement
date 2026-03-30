"use client";

type ModalArticleProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  categories?: string[];
};

const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

export function ModalArticle({ isOpen, onClose, onSave, categories = DEFAULT_CATEGORIES }: ModalArticleProps) {
  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalArticle">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalArticleTitle">
        <div className="modal-hd">
          <h2 id="modalArticleTitle">Nouvel article</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <input type="hidden" id="art-id" />
          <div className="fg full">
            <label>Désignation *</label>
            <input className="fi" id="art-nom" placeholder="Ex : Chaise Napoléon dorée" />
          </div>
          <div className="fg">
            <label>Référence</label>
            <input className="fi" id="art-ref" placeholder="MOB-001" />
          </div>
          <div className="fg">
            <label>Catégorie *</label>
            <select className="fs" id="art-cat" aria-label="Catégorie de l'article">
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Quantité totale *</label>
            <input className="fi" id="art-qty" type="number" min="0" placeholder="0" />
          </div>
          <div className="fg">
            <label>Valeur unitaire (F CFA)</label>
            <input className="fi" id="art-val" type="number" min="0" placeholder="0" />
          </div>
          <div className="fg">
            <label>Seuil alerte minimum</label>
            <input className="fi" id="art-seuil" type="number" min="0" placeholder="5" />
          </div>
          <div className="fg full">
            <label>Emoji / icône</label>
            <input className="fi" id="art-emoji" placeholder="🪑" maxLength={4} />
          </div>
          <div className="fg full">
            <label>Notes / Description</label>
            <textarea
              className="ft"
              id="art-notes"
              placeholder="Fournisseur, caractéristiques, remarques…"
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

