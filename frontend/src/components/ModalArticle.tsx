"use client";

import { ModalRoot } from "@/components/ModalRoot";
import { FormEvent, useEffect, useState } from "react";

import { ModalHeader } from "@/components/ModalHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import { ArticleCustomAttributesEditor } from "@/components/ArticleCustomAttributesEditor";
import { ArticleVariantsEditor } from "@/components/ArticleVariantsEditor";
import {
  formatCustomFieldsText,
  formatListLines,
} from "@/lib/item-attribute-helpers";
import { formatGalleryLines } from "@/lib/item-shared";
import { StockLevelsEditor } from "@/components/StockLevelsEditor";
import type { ArticleSavePayload } from "@/lib/stock/api";
import { EMPTY_STOCK_LEVELS } from "@/lib/stock-level-helpers";
import type { Article, ArticleCondition } from "@/lib/stock/types";

const CONDITIONS: ArticleCondition[] = ["Neuf", "Bon", "À réparer", "Obsolète"];

const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

function articleToPayload(article: Article): ArticleSavePayload {
  return {
    id: article.id,
    nom: article.nom,
    ref: article.ref,
    cat: article.cat,
    description: article.description,
    photoUrl: article.photoUrl,
    galleryText: formatGalleryLines(article.galleryUrls),
    emoji: article.emoji,
    notes: article.notes,
    brand: article.brand,
    model: article.model,
    variant: article.variant,
    weightKg: article.weightKg,
    lengthCm: article.lengthCm,
    widthCm: article.widthCm,
    heightCm: article.heightCm,
    barcode: article.barcode,
    serialNumber: article.serialNumber,
    lotNumber: article.lotNumber,
    supplierName: article.supplierName,
    valUnit: article.valUnit,
    rentalPrice: article.rentalPrice,
    salePrice: article.salePrice,
    usefulLifeMonths: article.usefulLifeMonths,
    qtyTotal: article.qtyTotal,
    seuilMin: article.seuilMin,
    stockLevels: { ...article.stockLevels },
    condition: article.condition,
    hasVariants: article.hasVariants,
    variants: article.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      size: v.size,
      color: v.color,
      modelName: v.modelName,
      valUnit: v.valUnit,
      rentalPrice: v.rentalPrice,
      salePrice: v.salePrice,
      qtyTotal: v.qtyTotal,
      seuilMin: v.seuilMin,
      stockLevels: { ...v.stockLevels },
      condition: v.condition,
      barcode: v.barcode,
    })),
    customFieldsText: formatCustomFieldsText(article.customFields),
    technicalParams: article.technicalParams ?? "",
    certificationsText: formatListLines(article.certifications),
    safetyStandardsText: formatListLines(article.safetyStandards),
    specialInstructions: article.specialInstructions ?? "",
  };
}

function emptyPayload(cat: string): ArticleSavePayload {
  return {
    nom: "",
    ref: "",
    cat,
    description: "",
    photoUrl: "",
    galleryText: "",
    emoji: "📦",
    notes: "",
    brand: "",
    model: "",
    variant: "",
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    barcode: "",
    serialNumber: "",
    lotNumber: "",
    supplierName: "",
    valUnit: 0,
    rentalPrice: null,
    salePrice: null,
    usefulLifeMonths: null,
    qtyTotal: 0,
    seuilMin: 5,
    stockLevels: { ...EMPTY_STOCK_LEVELS, min: 5, critical: 2, alert: 4 },
    condition: "Bon",
    hasVariants: false,
    variants: [],
    customFieldsText: "",
    technicalParams: "",
    certificationsText: "",
    safetyStandardsText: "",
    specialInstructions: "",
  };
}

type ModalArticleProps = {
  isOpen: boolean;
  initial: Article | null;
  onClose: () => void;
  onSubmit: (payload: ArticleSavePayload) => void | Promise<void>;
  categories?: string[];
};

export function ModalArticle({
  isOpen,
  initial,
  onClose,
  onSubmit,
  categories = DEFAULT_CATEGORIES,
}: ModalArticleProps) {
  const [form, setForm] = useState<ArticleSavePayload>(() => emptyPayload(categories[0] ?? "Autre"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(initial ? articleToPayload(initial) : emptyPayload(categories[0] ?? "Autre"));
    setBusy(false);
  }, [isOpen, initial, categories]);

  const isEdit = Boolean(initial?.id);

  function patch<K extends keyof ArticleSavePayload>(key: K, value: ArticleSavePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.nom.trim()) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...form, id: initial?.id });
    } finally {
      setBusy(false);
    }
  }

  const num = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  const intOrNull = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <ModalRoot isOpen={isOpen} id="modalArticle">
      <div className="modal modal--form modal-xl" role="dialog" aria-modal="true" aria-labelledby="modalArticleTitle">
        <ModalHeader
          icon="catalogue"
          title={isEdit ? "Modifier l'article" : "Nouvel article / SKU"}
          subtitle={isEdit ? "Mise à jour fiche catalogue" : "Création d'une référence stock"}
          onClose={onClose}
          titleId="modalArticleTitle"
        />
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
          <p className="form-section-title">Identification</p>
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="art-nom">Désignation *</label>
              <input id="art-nom" className="fi" value={form.nom} onChange={(e) => patch("nom", e.target.value)} required />
            </div>
            <div className="fg">
              <label htmlFor="art-ref">Code article (SKU) *</label>
              <input id="art-ref" className="fi mono" value={form.ref} onChange={(e) => patch("ref", e.target.value)} required />
            </div>
            <div className="fg">
              <label htmlFor="art-cat">Catégorie *</label>
              <select id="art-cat" className="fs" value={form.cat} onChange={(e) => patch("cat", e.target.value)} required>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg full">
              <label htmlFor="art-desc">Description détaillée</label>
              <textarea id="art-desc" className="ft" rows={3} value={form.description ?? ""} onChange={(e) => patch("description", e.target.value)} />
            </div>
          </div>
          <p className="form-section-title">Médias</p>
          <div className="form-grid form-premium">
            <div className="fg full">
              <label htmlFor="art-photo">Photo principale (URL)</label>
              <input id="art-photo" className="fi" type="url" value={form.photoUrl ?? ""} onChange={(e) => patch("photoUrl", e.target.value)} />
            </div>
            <div className="fg full">
              <label htmlFor="art-gallery">Galerie — une URL par ligne</label>
              <textarea id="art-gallery" className="ft" rows={3} value={form.galleryText ?? ""} onChange={(e) => patch("galleryText", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-emoji">Emoji</label>
              <input id="art-emoji" className="fi" value={form.emoji ?? "📦"} onChange={(e) => patch("emoji", e.target.value)} maxLength={8} />
            </div>
          </div>

          <p className="form-section-title">Caractéristiques & traçabilité</p>
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="art-brand">Marque / fabricant</label>
              <input id="art-brand" className="fi" value={form.brand ?? ""} onChange={(e) => patch("brand", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-model">Modèle / version</label>
              <input id="art-model" className="fi" value={form.model ?? ""} onChange={(e) => patch("model", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-variant">Couleur / taille / variante</label>
              <input id="art-variant" className="fi" value={form.variant ?? ""} onChange={(e) => patch("variant", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-weight">Poids (kg)</label>
              <input id="art-weight" className="fi" type="number" min="0" step="0.01" value={form.weightKg ?? ""} onChange={(e) => patch("weightKg", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-length">Longueur (cm)</label>
              <input id="art-length" className="fi" type="number" min="0" step="0.1" value={form.lengthCm ?? ""} onChange={(e) => patch("lengthCm", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-width">Largeur (cm)</label>
              <input id="art-width" className="fi" type="number" min="0" step="0.1" value={form.widthCm ?? ""} onChange={(e) => patch("widthCm", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-height">Hauteur (cm)</label>
              <input id="art-height" className="fi" type="number" min="0" step="0.1" value={form.heightCm ?? ""} onChange={(e) => patch("heightCm", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-barcode">Code-barres</label>
              <input id="art-barcode" className="fi mono" value={form.barcode ?? ""} onChange={(e) => patch("barcode", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-serial">N° de série</label>
              <input id="art-serial" className="fi" value={form.serialNumber ?? ""} onChange={(e) => patch("serialNumber", e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="art-lot">N° de lot</label>
              <input id="art-lot" className="fi" value={form.lotNumber ?? ""} onChange={(e) => patch("lotNumber", e.target.value)} />
            </div>
          </div>

          <ArticleVariantsEditor
            parentRef={form.ref}
            hasVariants={Boolean(form.hasVariants)}
            variants={form.variants ?? []}
            onHasVariantsChange={(value) => patch("hasVariants", value)}
            onVariantsChange={(variants) => patch("variants", variants)}
          />

          <p className="form-section-title">Tarifs & stock{form.hasVariants ? " (fiche parent)" : ""}</p>
          <div className="form-grid form-premium">
            <div className="fg">
              <label htmlFor="art-supplier">Fournisseur principal</label>
              <input id="art-supplier" className="fi" value={form.supplierName ?? ""} onChange={(e) => patch("supplierName", e.target.value)} />
            </div>
            {!form.hasVariants ? (
            <>
            <div className="fg">
              <label htmlFor="art-cost">Coût unitaire (F CFA)</label>
              <input id="art-cost" className="fi" type="number" min="0" value={form.valUnit} onChange={(e) => patch("valUnit", Number.parseFloat(e.target.value) || 0)} />
            </div>
            <div className="fg">
              <label htmlFor="art-rental">Prix de location (F CFA)</label>
              <input id="art-rental" className="fi" type="number" min="0" value={form.rentalPrice ?? ""} onChange={(e) => patch("rentalPrice", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-sale">Prix de vente (F CFA)</label>
              <input id="art-sale" className="fi" type="number" min="0" value={form.salePrice ?? ""} onChange={(e) => patch("salePrice", num(e.target.value))} />
            </div>
            <div className="fg">
              <label htmlFor="art-condition">État</label>
              <select id="art-condition" className="fs" value={form.condition} onChange={(e) => patch("condition", e.target.value as ArticleCondition)}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label htmlFor="art-qty">Quantité totale *</label>
              <input id="art-qty" className="fi" type="number" min="0" value={form.qtyTotal} onChange={(e) => patch("qtyTotal", Number.parseInt(e.target.value, 10) || 0)} required />
            </div>
            <div className="fg full">
              <p className="form-section-title mb8">Niveaux de stock</p>
              <StockLevelsEditor
                idPrefix="art"
                levels={form.stockLevels}
                onChange={(stockLevels) => {
                  patch("stockLevels", stockLevels);
                  patch("seuilMin", stockLevels.min);
                }}
              />
            </div>
            </>
            ) : null}
            <div className="fg">
              <label htmlFor="art-life">Durée de vie utile (mois)</label>
              <input id="art-life" className="fi" type="number" min="0" value={form.usefulLifeMonths ?? ""} onChange={(e) => patch("usefulLifeMonths", intOrNull(e.target.value))} />
            </div>
            <div className="fg full">
              <label htmlFor="art-notes">Notes internes</label>
              <textarea id="art-notes" className="ft" rows={2} value={form.notes ?? ""} onChange={(e) => patch("notes", e.target.value)} />
            </div>
          </div>

          <ArticleCustomAttributesEditor
            customFieldsText={form.customFieldsText ?? ""}
            technicalParams={form.technicalParams ?? ""}
            certificationsText={form.certificationsText ?? ""}
            safetyStandardsText={form.safetyStandardsText ?? ""}
            specialInstructions={form.specialInstructions ?? ""}
            onCustomFieldsTextChange={(value) => patch("customFieldsText", value)}
            onTechnicalParamsChange={(value) => patch("technicalParams", value)}
            onCertificationsTextChange={(value) => patch("certificationsText", value)}
            onSafetyStandardsTextChange={(value) => patch("safetyStandardsText", value)}
            onSpecialInstructionsChange={(value) => patch("specialInstructions", value)}
          />
          </div>

          <div className="modal-ft">
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-gold" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </ModalRoot>
  );
}
