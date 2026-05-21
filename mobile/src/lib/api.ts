import Constants from "expo-constants";
import { Platform } from "react-native";

import { clearSession, getSessionToken, setSessionToken } from "@/lib/auth-storage";

export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "COMMERCIAL"
  | "STOREKEEPER"
  | "TECHNICAL_MANAGER"
  | "FLEET_MANAGER"
  | "TECHNICIAN"
  | "VIEWER";

export type AuthMeUser = {
  id: string;
  username?: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
};

export type LoginApiResult =
  | { user: AuthMeUser; sessionToken?: string; needsTwoFactor?: false }
  | {
      needsTwoFactor: true;
      pendingToken?: string;
      user: { id: string; fullName: string; email: string };
    };

/** URL effectivement utilisée par fetch (émulateur Android → 10.0.2.2). */
export function apiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const configured = (raw || "http://localhost:3000").replace(/\/+$/, "");

  if (Platform.OS === "android" && !Constants.isDevice) {
    try {
      const u = new URL(configured);
      return `http://10.0.2.2:${u.port || "3000"}`;
    } catch {
      return "http://10.0.2.2:3000";
    }
  }

  return configured;
}

export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${normalized}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(resolveApiUrl(path), { ...init, headers });
}

export async function loginViaApi(identifier: string, password: string): Promise<LoginApiResult> {
  const response = await fetch(resolveApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  const body = (await response.json().catch(() => null)) as
    | (LoginApiResult & { message?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.message ?? `Erreur HTTP ${response.status}`);
  }
  if (body && "needsTwoFactor" in body && body.needsTwoFactor) {
    return body;
  }
  const result = body as { user: AuthMeUser; sessionToken?: string };
  if (result.sessionToken) {
    await setSessionToken(result.sessionToken);
  }
  return result;
}

export async function verifyTwoFactorViaApi(
  code: string,
  pendingToken?: string,
): Promise<{ user: AuthMeUser; sessionToken?: string }> {
  const response = await fetch(resolveApiUrl("/api/auth/2fa/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, pendingToken }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    user?: AuthMeUser;
    sessionToken?: string;
  };
  if (!response.ok) {
    throw new Error(body.message ?? "Code 2FA invalide");
  }
  if (body.sessionToken) {
    await setSessionToken(body.sessionToken);
  }
  return body as { user: AuthMeUser; sessionToken?: string };
}

export async function logoutViaApi(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    await clearSession();
  }
}

export async function fetchAuthMe(): Promise<AuthMeUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const response = await apiFetch("/api/auth/me");
  if (response.status === 401) {
    await clearSession();
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as AuthMeUser;
}
