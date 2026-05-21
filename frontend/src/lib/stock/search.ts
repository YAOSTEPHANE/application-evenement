import type { Movement, StockState } from "./types";

function movementSearchText(m: Movement, state: StockState): string {
  const parts = [m.type, m.reason, m.fromLabel, m.toLabel, m.operateur, m.note, m.etat];
  const ev = state.evenements.find((e) => e.id === m.evId);
  if (ev) {
    parts.push(ev.nom, ev.client);
  }
  const art = state.articles.find((a) => a.id === m.articleId);
  if (art) {
    parts.push(art.nom, art.ref);
  }
  return parts.join(" ").toLowerCase();
}

type SearchResult =
  | { type: "article"; label: string; page: "catalogue" }
  | { type: "event"; label: string; page: "commandes" }
  | { type: "user"; label: string; page: "utilisateurs" }
  | { type: "movement"; label: string; page: "bons" }
  | { type: "rfid"; label: string; page: "rfid" };

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
    return { type: "event", label: event.nom, page: "commandes" };
  }

  const movement = state.mouvements.find((m) => movementSearchText(m, state).includes(q));
  if (movement) {
    const ev = state.evenements.find((e) => e.id === movement.evId);
    const label = ev
      ? `${movement.type} — ${ev.nom}`
      : `${movement.type}${movement.reason ? ` — ${movement.reason}` : ""}`;
    return { type: "movement", label, page: "bons" };
  }

  if (q.startsWith("tag-")) {
    return { type: "rfid", label: q.toUpperCase(), page: "rfid" };
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

