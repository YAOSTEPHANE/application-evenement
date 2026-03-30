import { STORE_KEY } from "./defaultState";
import { loadState } from "./storage";
import type { StockState } from "./types";

/** Identifiant utilisateur issu de l’écran de connexion (séparé du cache métier). */
export const SESSION_USER_ID_KEY = "stockevent_session_user_id";

export function getPersistedSessionUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(SESSION_USER_ID_KEY)?.trim();
  return value || null;
}

/** Applique l’utilisateur connecté au state chargé (API ou local). */
export function applySessionToState(state: StockState): StockState {
  const id = getPersistedSessionUserId();
  if (!id) {
    return state;
  }
  if (state.utilisateurs.some((user) => user.id === id)) {
    return { ...state, currentUser: id };
  }
  // Liste vide ou pas encore chargée : ne pas invalider la session (évite courses / réponses partielles).
  if (state.utilisateurs.length === 0) {
    return { ...state, currentUser: id };
  }
  clearSession();
  return { ...state, currentUser: "" };
}

export function setSessionUserId(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SESSION_USER_ID_KEY, userId);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as StockState;
    parsed.currentUser = userId;
    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_USER_ID_KEY);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as StockState;
    parsed.currentUser = "";
    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function loadStateWithSession(): StockState {
  return applySessionToState(loadState());
}
