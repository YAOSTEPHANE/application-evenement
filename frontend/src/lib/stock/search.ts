import type { StockState } from "./types";

type SearchResult =
  | { type: "article"; label: string; page: "catalogue" }
  | { type: "event"; label: string; page: "evenements" }
  | { type: "user"; label: string; page: "utilisateurs" };

export function globalSearch(state: StockState, query: string): SearchResult | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return null;
  }

  const article = state.articles.find(
    (item) => item.nom.toLowerCase().includes(q) || item.ref.toLowerCase().includes(q),
  );
  if (article) {
    return { type: "article", label: article.nom, page: "catalogue" };
  }

  const event = state.evenements.find(
    (item) => item.nom.toLowerCase().includes(q) || item.client.toLowerCase().includes(q),
  );
  if (event) {
    return { type: "event", label: event.nom, page: "evenements" };
  }

  const user = state.utilisateurs.find(
    (item) =>
      `${item.prenom} ${item.nom}`.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      (item.username?.toLowerCase().includes(q) ?? false),
  );
  if (user) {
    return { type: "user", label: `${user.prenom} ${user.nom}`, page: "utilisateurs" };
  }

  return null;
}

