/** URL de base API affichable côté serveur (paramètres, toasts seed, etc.). */
export function getApiOriginForDisplay(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (appUrl) {
    const normalized = appUrl.replace(/\/+$/, "");
    return normalized.startsWith("http") ? normalized : `https://${normalized}`;
  }
  return "http://localhost:3001";
}
