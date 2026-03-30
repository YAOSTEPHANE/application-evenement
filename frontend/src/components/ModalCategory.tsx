"use client";

import { useEffect, useState } from "react";

function slugify(s: string): string {
  const raw = s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "categorie";
}

type ModalCategoryProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initial: { id: string; name: string; slug: string } | null;
  onClose: () => void;
  onSubmit: (payload: { id?: string; name: string; slug: string }) => void | Promise<void>;
};

export function ModalCategory({ isOpen, mode, initial, onClose, onSubmit }: ModalCategoryProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initial?.name ?? "");
    setSlug(initial?.slug ?? "");
    setSlugManual(mode === "edit");
    setBusy(false);
  }, [isOpen, initial, mode]);

  useEffect(() => {
    if (!isOpen || slugManual) {
      return;
    }
    setSlug(slugify(name));
  }, [name, isOpen, slugManual]);

  const title = mode === "edit" ? "Modifier la catégorie" : "Nouvelle catégorie";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const sl = slug.trim().toLowerCase();
    if (n.length < 2 || sl.length < 2) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit(mode === "edit" && initial ? { id: initial.id, name: n, slug: sl } : { name: n, slug: sl });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-bg${isOpen ? " open" : ""}`} id="modalCategory">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalCatTitle">
        <div className="modal-hd">
          <h2 id="modalCatTitle">{title}</h2>
          <button className="modal-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="fg full">
              <label htmlFor="cat-name">Nom affiché *</label>
              <input
                id="cat-name"
                className="fi"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="ex. Audiovisuel"
                minLength={2}
                required
                autoComplete="off"
              />
            </div>
            <div className="fg full">
              <label htmlFor="cat-slug">Identifiant URL (slug) *</label>
              <input
                id="cat-slug"
                className="fi"
                value={slug}
                onChange={(ev) => {
                  setSlugManual(true);
                  setSlug(ev.target.value);
                }}
                placeholder="audiovisuel"
                minLength={2}
                required
                autoComplete="off"
              />
              <p className="fs11 fc-3 mt4">Lettres minuscules, chiffres et tirets. Unique par organisation.</p>
            </div>
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-gold" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
