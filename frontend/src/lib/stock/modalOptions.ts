import { dispo } from "./helpers";
import type { StockState } from "./types";

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
  return state.articles
    .map(
      (article) =>
        `<option value="${article.id}">${article.emoji || "📦"} ${article.nom} — ${dispo(article)} dispo</option>`,
    )
    .join("");
}

export function buildArticleOptions(state: StockState) {
  return state.articles
    .map((article) => `<option value="${article.id}">${article.emoji || "📦"} ${article.nom}</option>`)
    .join("");
}

export function buildEventOptions(state: StockState, includeNone = true) {
  const noneOption = includeNone ? '<option value="">— Aucun —</option>' : "";
  return noneOption + state.evenements.map((event) => `<option value="${event.id}">${event.nom}</option>`).join("");
}

