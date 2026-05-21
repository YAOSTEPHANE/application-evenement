"use client";

import { StockLevelsEditor } from "@/components/StockLevelsEditor";
import type { VariantSavePayload } from "@/lib/stock/api";
import { EMPTY_STOCK_LEVELS } from "@/lib/stock-level-helpers";
import type { ArticleCondition } from "@/lib/stock/types";

const CONDITIONS: ArticleCondition[] = ["Neuf", "Bon", "À réparer", "Obsolète"];

export function emptyVariantRow(parentRef: string, index: number): VariantSavePayload {
  const base = (parentRef.trim() || "SKU").toUpperCase();
  return {
    sku: `${base}-V${String(index + 1).padStart(2, "0")}`,
    size: "",
    color: "",
    modelName: "",
    valUnit: 0,
    rentalPrice: null,
    salePrice: null,
    qtyTotal: 0,
    seuilMin: 5,
    stockLevels: { ...EMPTY_STOCK_LEVELS, min: 5 },
    condition: "Bon",
    barcode: "",
  };
}

type ArticleVariantsEditorProps = {
  parentRef: string;
  hasVariants: boolean;
  variants: VariantSavePayload[];
  onHasVariantsChange: (value: boolean) => void;
  onVariantsChange: (variants: VariantSavePayload[]) => void;
};

export function ArticleVariantsEditor({
  parentRef,
  hasVariants,
  variants,
  onHasVariantsChange,
  onVariantsChange,
}: ArticleVariantsEditorProps) {
  const num = (raw: string) => {
    if (raw.trim() === "") {
      return null;
    }
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  function updateRow(index: number, patch: Partial<VariantSavePayload>) {
    const next = [...variants];
    next[index] = { ...next[index], ...patch };
    onVariantsChange(next);
  }

  return (
    <>
      <p className="form-section-title">Variantes (stock séparé par SKU)</p>
      <div className="fg full mb8">
        <label className="form-check">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => {
              const checked = e.target.checked;
              onHasVariantsChange(checked);
              if (checked && variants.length === 0) {
                onVariantsChange([emptyVariantRow(parentRef, 0)]);
              }
              if (!checked) {
                onVariantsChange([]);
              }
            }}
          />
          <span className="form-check-box" aria-hidden />
          <span className="form-check-label">Produit avec variantes (taille, couleur, modèle...)</span>
        </label>
      </div>
      {hasVariants ? (
        <div className="variant-editor mb12">
          {variants.map((row, index) => (
            <div key={row.id ?? `new-${index}`} className="variant-row card card-pad mb8">
              <div className="form-grid form-premium">
                <div className="fg">
                  <label>SKU *</label>
                  <input className="fi mono" value={row.sku} onChange={(e) => updateRow(index, { sku: e.target.value })} required />
                </div>
                <div className="fg">
                  <label>Couleur</label>
                  <input className="fi" value={row.color ?? ""} onChange={(e) => updateRow(index, { color: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Taille</label>
                  <input className="fi" value={row.size ?? ""} onChange={(e) => updateRow(index, { size: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Modèle</label>
                  <input className="fi" value={row.modelName ?? ""} onChange={(e) => updateRow(index, { modelName: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Coût (F)</label>
                  <input className="fi" type="number" min="0" value={row.valUnit} onChange={(e) => updateRow(index, { valUnit: Number.parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="fg">
                  <label>Qté *</label>
                  <input className="fi" type="number" min="0" value={row.qtyTotal} onChange={(e) => updateRow(index, { qtyTotal: Number.parseInt(e.target.value, 10) || 0 })} required />
                </div>
                <div className="fg full">
                  <p className="fs12 fw600 mb4">Niveaux de stock</p>
                  <StockLevelsEditor
                    idPrefix={`var-${index}`}
                    levels={row.stockLevels}
                    onChange={(stockLevels) =>
                      updateRow(index, { stockLevels, seuilMin: stockLevels.min })
                    }
                  />
                </div>
                <div className="fg">
                  <label>État</label>
                  <select className="fs" value={row.condition} onChange={(e) => updateRow(index, { condition: e.target.value as ArticleCondition })}>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="fg">
                  <label>Location (F)</label>
                  <input className="fi" type="number" min="0" value={row.rentalPrice ?? ""} onChange={(e) => updateRow(index, { rentalPrice: num(e.target.value) })} />
                </div>
                <div className="fg">
                  <label>Vente (F)</label>
                  <input className="fi" type="number" min="0" value={row.salePrice ?? ""} onChange={(e) => updateRow(index, { salePrice: num(e.target.value) })} />
                </div>
              </div>
              <button className="btn btn-outline btn-xs mt8" type="button" onClick={() => onVariantsChange(variants.filter((_, i) => i !== index))}>
                Supprimer
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => onVariantsChange([...variants, emptyVariantRow(parentRef, variants.length)])}
          >
            + Ajouter une variante
          </button>
        </div>
      ) : null}
    </>
  );
}
