import { isProductionEnv } from "@/lib/env-runtime";

const DEFAULT_DEV_SECRET = "dev-only-stockevent-secret-min-32-chars!!";

/** Secret JWT session — AUTH_JWT_SECRET prioritaire, NEXTAUTH_SECRET en alias rétrocompat. */
export function resolveAuthJwtSecret(): string {
  const configured =
    process.env.AUTH_JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (isProductionEnv()) {
    throw new Error(
      "AUTH_JWT_SECRET est obligatoire en production (≥ 32 caractères). Vous pouvez aussi utiliser NEXTAUTH_SECRET en alias.",
    );
  }
  return DEFAULT_DEV_SECRET;
}

export function hasAuthJwtSecretConfigured(): boolean {
  return Boolean(
    process.env.AUTH_JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
  );
}
