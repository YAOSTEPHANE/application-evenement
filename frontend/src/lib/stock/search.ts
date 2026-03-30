import type { StockState } from "./types";

type SearchResult =
  | { type: "article"; label: string; page: "catalogue" }
  | { type: "event"; label: string; page: "evenements" };

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

  return null;
}

