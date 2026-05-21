import {
  computeStockLevelStatus,
  isStockAlertStatus,
  stockLevelsForArticle,
  stockLevelsForVariant,
  type StockLevelStatus,
  type StockLevels,
} from "@/lib/stock-level-helpers";

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

export function dispoVariant(variant: Article["variants"][number]) {
  return Math.max(0, (variant.qtyTotal || 0) - (variant.qtyAff || 0));
}

export function articleStockStatus(article: Article, availableQty?: number): StockLevelStatus {
  const available = availableQty ?? dispo(article);
  return computeStockLevelStatus(available, stockLevelsForArticle(article));
}

export function variantStockStatus(
  variant: Article["variants"][number],
  availableQty?: number,
): StockLevelStatus {
  const available = availableQty ?? dispoVariant(variant);
  return computeStockLevelStatus(available, stockLevelsForVariant(variant));
}

export function isArticleStockAlert(article: Article): boolean {
  return isStockAlertStatus(articleStockStatus(article));
}

export function resolveStockLevels(
  article: Article,
  variant?: Article["variants"][number] | null,
): StockLevels {
  return variant ? stockLevelsForVariant(variant) : stockLevelsForArticle(article);
}

export function initials(prenom: string, nom: string) {
  return ((prenom || "")[0] + (nom || "")[0]).toUpperCase();
}

