"use client";

import { ModalRoot } from "@/components/ModalRoot";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";

import {
  CATEGORY_CODE_REGEX,
  formatMetadataLines,
  parseMetadataLines,
  proposeCategoryCode,
  slugifyCategoryName,
} from "@/lib/category-helpers";
import { categoryLevelLabel } from "@/lib/category-tree";
import type { CategoryFormPayload, CategoryParentPreset, CategoryWithCount } from "@/lib/stock/api";

type ModalCategoryProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  initial: CategoryWithCount | null;
  parentPreset: CategoryParentPreset | null;
  parentOptions: CategoryWithCount[];
  onClose: () => void;
  onSubmit: (payload: CategoryFormPayload) => void | Promise<void>;
};

export function ModalCategory({
  isOpen,
  mode,
  initial,
  parentPreset,
  parentOptions,
  onClose,
  onSubmit,
}: ModalCategoryProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [icon, setIcon] = useState("▤");
  const [metadataText, setMetadataText] = useState("");
  const [active, setActive] = useState(true);
  const [parentId, setParentId] = useState<string>("");
  const [slugManual, setSlugManual] = useState(false);
  const [codeManual, setCodeManual] = useState(false);
  const [busy, setBusy] = useState(false);

  const lockedParent = parentPreset ?? (mode === "edit" ? null : null);
  const effectiveParentId = lockedParent?.id ?? (parentId || null);

  const parentRow = useMemo(() => {
    if (!effectiveParentId) {
      return null;
    }
    return parentOptions.find((row) => row.id === effectiveParentId) ?? null;
  }, [effectiveParentId, parentOptions]);

  const nextLevel = parentRow ? parentRow.level + 1 : lockedParent ? lockedParent.level + 1 : 0;

  const eligibleParents = useMemo(
    () => parentOptions.filter((row) => row.level < 2 && row.active),
    [parentOptions],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initial?.name ?? "");
    setSlug(initial?.slug ?? "");
    setCode(initial?.code ?? "");
    setDescription(initial?.description ?? "");
    setPhotoUrl(initial?.photoUrl ?? "");
    setIcon(initial?.icon ?? "▤");
    setMetadataText(formatMetadataLines(initial?.metadata as Record<string, unknown> | undefined));
    setActive(initial?.active ?? true);
    setParentId(initial?.parentId ?? parentPreset?.id ?? "");
    setSlugManual(mode === "edit");
    setCodeManual(mode === "edit");
    setBusy(false);
  }, [isOpen, initial, mode, parentPreset]);

  useEffect(() => {
    if (!isOpen || slugManual) {
      return;
    }
    setSlug(slugifyCategoryName(name));
  }, [name, isOpen, slugManual]);

  useEffect(() => {
    if (!isOpen || codeManual) {
      return;
    }
    const parentCode = parentRow?.code ?? lockedParent?.code ?? null;
    setCode(proposeCategoryCode(slug || slugifyCategoryName(name), parentCode));
  }, [slug, name, isOpen, codeManual, parentRow, lockedParent]);

  const title =
    mode === "edit"
      ? "Modifier la catégorie"
      : lockedParent
        ? `Nouvelle sous-catégorie de « ${lockedParent.name} »`
        : "Nouvelle catégorie";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const sl = slug.trim().toLowerCase();
    const cd = code.trim().toUpperCase();
    if (n.length < 2 || sl.length < 2 || !CATEGORY_CODE_REGEX.test(cd)) {
      return;
    }
    setBusy(true);
    try {
      const metadata = parseMetadataLines(metadataText);
      const payload: CategoryFormPayload = {
        id: mode === "edit" && initial ? initial.id : undefined,
        name: n,
        slug: sl,
        code: cd,
        description: description.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        icon: icon.trim() || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        active,
        parentId: effectiveParentId,
      };
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  }

  function handlePhotoFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <ModalRoot isOpen={isOpen} id="modalCategory">
      <div className="modal modal--form modal-lg" role="dialog" aria-modal="true" aria-labelledby="modalCatTitle">
        <ModalHeader
          icon="categories"
          title={title}
          subtitle="Arborescence catalogue · code · métadonnées"
          onClose={onClose}
          titleId="modalCatTitle"
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="cat-name">Nom affiché *</label>
              <input
                id="cat-name"
                className="fi"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="ex. Chaises"
                minLength={2}
                required
                autoComplete="off"
              />
            </div>

            <div className="fg">
              <label htmlFor="cat-code">Code standardisé *</label>
              <input
                id="cat-code"
                className="fi mono"
                value={code}
                onChange={(ev) => {
                  setCodeManual(true);
                  setCode(ev.target.value.toUpperCase());
                }}
                placeholder="MOB-CHR"
                required
                autoComplete="off"
              />
              <p className="fs11 fc-3 mt4">Format : MOB, MOB-CHR, MOB-CHR-NAP</p>
            </div>

            <div className="fg">
              <label htmlFor="cat-slug">Slug URL *</label>
              <input
                id="cat-slug"
                className="fi mono"
                value={slug}
                onChange={(ev) => {
                  setSlugManual(true);
                  setSlug(ev.target.value);
                }}
                placeholder="chaises"
                minLength={2}
                required
                autoComplete="off"
              />
            </div>

            <div className="fg">
              <label htmlFor="cat-icon">Icône</label>
              <input
                id="cat-icon"
                className="fi"
                value={icon}
                onChange={(ev) => setIcon(ev.target.value)}
                placeholder="🪑"
                maxLength={8}
              />
            </div>

            <div className="fg">
              <label htmlFor="cat-level">Niveau</label>
              <input
                id="cat-level"
                className="fi"
                value={categoryLevelLabel(nextLevel)}
                readOnly
                aria-readonly
              />
            </div>

            <div className="fg full">
              <label htmlFor="cat-parent">Catégorie parente</label>
              {lockedParent ? (
                <input
                  id="cat-parent"
                  className="fi"
                  value={`${lockedParent.name} (${lockedParent.code})`}
                  readOnly
                  aria-readonly
                />
              ) : (
                <select
                  id="cat-parent"
                  className="fs"
                  value={parentId}
                  onChange={(ev) => setParentId(ev.target.value)}
                  disabled={mode === "edit" && (initial?.childrenCount ?? 0) > 0}
                >
                  <option value="">— Racine (niveau 1) —</option>
                  {eligibleParents.map((row) => (
                    <option key={row.id} value={row.id}>
                      {"—".repeat(row.level)} {row.name} ({row.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="fg full">
              <label htmlFor="cat-desc">Description</label>
              <textarea
                id="cat-desc"
                className="ft"
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                placeholder="Usage, consignes de stockage, fournisseurs types…"
                rows={3}
              />
            </div>

            <div className="fg full">
              <label htmlFor="cat-photo-url">Photo (URL ou fichier)</label>
              <div className="cat-photo-row">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="cat-modal-photo"
                    unoptimized
                  />
                ) : (
                  <span className="cat-modal-photo cat-modal-photo-ph">▤</span>
                )}
                <div className="cat-photo-fields">
                  <input
                    id="cat-photo-url"
                    className="fi"
                    value={photoUrl.startsWith("data:") ? "" : photoUrl}
                    onChange={(ev) => setPhotoUrl(ev.target.value)}
                    placeholder="https://…"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="fi"
                    onChange={(ev) => handlePhotoFile(ev.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <div className="fg full">
              <label htmlFor="cat-meta">Métadonnées (clé: valeur par ligne)</label>
              <textarea
                id="cat-meta"
                className="ft mono"
                value={metadataText}
                onChange={(ev) => setMetadataText(ev.target.value)}
                placeholder={"couleur: or\nmateriau: aluminium\nfragile: true"}
                rows={4}
              />
            </div>

            <div className="fg full">
              <label className="form-check" htmlFor="cat-active">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={active}
                  onChange={(ev) => setActive(ev.target.checked)}
                />
                <span className="form-check-box" aria-hidden />
                <span className="form-check-label">Catégorie active (visible dans le catalogue)</span>
              </label>
            </div>
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
    </ModalRoot>
  );
}
