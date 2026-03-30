import { dispo, initials } from "./helpers";
import type { Article, Evenement, StockState, Utilisateur } from "./types";

export function getArticle(state: StockState, id: string): Article | undefined {
  return state.articles.find((article) => article.id === id);
}

export function getEvent(state: StockState, id: string): Evenement | undefined {
  return state.evenements.find((event) => event.id === id);
}

export function getUser(state: StockState, id: string): Utilisateur | undefined {
  return state.utilisateurs.find((user) => user.id === id);
}

export function currentUserName(state: StockState) {
  const user = getUser(state, state.currentUser);
  return user ? `${user.prenom} ${user.nom[0]}.` : "Utilisateur";
}

export function currentUserDisplay(state: StockState) {
  const user = getUser(state, state.currentUser);
  if (!user) {
    return {
      fullName: "Utilisateur",
      initials: "U",
      role: "",
      avatarUrl: "",
    };
  }

  return {
    fullName: `${user.prenom} ${user.nom}`,
    initials: initials(user.prenom, user.nom),
    role: user.role,
    avatarUrl: user.avatarUrl ?? "",
  };
}

export function counts(state: StockState) {
  const evenementsActifs = state.evenements.filter(
    (event) => event.statut !== "Terminé" && event.statut !== "Annulé",
  ).length;

  const alertes = state.articles.filter((article) => dispo(article) <= article.seuilMin).length;

  return {
    catalogue: state.articles.length,
    evenements: evenementsActifs,
    alertes,
  };
}

