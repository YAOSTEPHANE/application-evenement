import { dispo, dispoVariant } from "./helpers";
import { stockTargetValue } from "@/lib/item-variant-helpers";
import type { StockState } from "./types";

function stockOptionRows(state: StockState) {
  const rows: Array<{ value: string; label: string; dispo: number }> = [];
  for (const article of state.articles) {
    if (article.hasVariants && article.variants.length > 0) {
      for (const variant of article.variants) {
        rows.push({
          value: stockTargetValue(article.id, variant.id),
          label: `${article.emoji || "📦"} ${article.nom} — ${variant.label} (${variant.sku})`,
          dispo: dispoVariant(variant),
        });
      }
    } else {
      rows.push({
        value: article.id,
        label: `${article.emoji || "📦"} ${article.nom} — ${article.ref}`,
        dispo: dispo(article),
      });
    }
  }
  return rows;
}

export function buildUserOptions(state: StockState) {
  return (
    '<option value="">— Sélectionner —</option>' +
    state.utilisateurs
      .map((user) => {
        const fullName = `${user.prenom} ${user.nom}`;
        return `<option value="${fullName}">${fullName}</option>`;
      })
      .join("")
  );
}

export function buildAffectArticleOptions(state: StockState) {
  return stockOptionRows(state)
    .map((row) => `<option value="${row.value}">${row.label} — ${row.dispo} dispo</option>`)
    .join("");
}

export function buildArticleOptions(state: StockState) {
  return stockOptionRows(state)
    .map((row) => `<option value="${row.value}">${row.label}</option>`)
    .join("");
}

export function buildArticleSelectOptions(state: StockState) {
  return stockOptionRows(state).map((row) => ({ value: row.value, label: row.label }));
}

export function buildEventSelectOptions(state: StockState, activeOnly = false) {
  const events = activeOnly
    ? state.evenements.filter((e) => e.statut !== "Terminé" && e.statut !== "Annulé")
    : state.evenements;
  return events.map((event) => ({ value: event.id, label: event.nom }));
}

export function buildEventOptions(state: StockState, includeNone = true) {
  const noneOption = includeNone ? '<option value="">— Aucun —</option>' : "";
  return noneOption + state.evenements.map((event) => `<option value="${event.id}">${event.nom}</option>`).join("");
}

