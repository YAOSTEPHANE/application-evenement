import { defaultState, STORE_KEY } from "./defaultState";
import type { StockState } from "./types";

export function loadState(): StockState {
  if (typeof window === "undefined") {
    return defaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      return defaultState();
    }
    return JSON.parse(raw) as StockState;
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

