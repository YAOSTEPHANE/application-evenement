import { stockLevelsForArticle, stockLevelsForVariant } from "@/lib/stock-level-helpers";

import { defaultState, STORE_KEY } from "./defaultState";
import { emptyArticleFields, type Article, type StockState } from "./types";

function hydrateArticleStockLevels(article: Article): Article {
  const base = { ...emptyArticleFields(), ...article };
  return {
    ...base,
    stockLevels: stockLevelsForArticle(base),
    variants: (base.variants ?? []).map((variant) => ({
      ...variant,
      stockLevels: stockLevelsForVariant(variant),
    })),
  };
}

function hydrateStockState(state: StockState): StockState {
  return {
    ...state,
    articles: state.articles.map(hydrateArticleStockLevels),
  };
}

export function loadState(): StockState {
  if (typeof window === "undefined") {
    return defaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      return defaultState();
    }
    return hydrateStockState(JSON.parse(raw) as StockState);
  } catch {
    return defaultState();
  }
}

export function saveState(state: StockState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

