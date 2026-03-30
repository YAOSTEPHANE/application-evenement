import type { Article } from "./types";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function fmt(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNum(n: number | undefined) {
  return n?.toLocaleString("fr-FR") ?? "0";
}

export function dispo(article: Article) {
  return Math.max(0, (article.qtyTotal || 0) - (article.qtyAff || 0));
}

export function initials(prenom: string, nom: string) {
  return ((prenom || "")[0] + (nom || "")[0]).toUpperCase();
}

