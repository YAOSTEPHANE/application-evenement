import type { NextRequest } from "next/server";

import { getRequestContext, type RequestContext } from "@/lib/request-context";
import { isProductionEnv } from "@/lib/env-runtime";

export { isProductionEnv };

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

/** Contexte avec utilisateur identifié (JWT ou legacy autorisé par le proxy). */
export async function requireAuthenticatedContext(): Promise<RequestContext> {
  const ctx = await getRequestContext();
  if (ctx.authMethod === "none" || !ctx.actorId) {
    throw new ApiAuthError("Connexion requise", 401);
  }
  return ctx;
}

/** Vérifie l’accès à POST /api/setup/seed. */
export function assertSeedRequestAllowed(request: Request): void {
  if (!isProductionEnv()) {
    return;
  }
  const secret = process.env.SEED_SECRET?.trim();
  if (!secret) {
    throw new ApiAuthError(
      "Seed désactivé en production (définir SEED_SECRET et Authorization: Bearer …).",
      503,
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    throw new ApiAuthError("Non autorisé", 401);
  }
}

/** Vérifie le secret cron pour /api/cdc/alerts/run (proxy laisse passer sans session). */
export function assertCronSecret(request: Request): void {
  const secret = process.env.CDC_CRON_SECRET?.trim();
  if (!secret) {
    throw new ApiAuthError("CDC_CRON_SECRET non configuré", 503);
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    throw new ApiAuthError("Non autorisé", 401);
  }
}

/** Contrôle seed au niveau edge (production). */
export function proxyAllowsSeed(request: NextRequest): boolean {
  if (!isProductionEnv()) {
    return true;
  }
  const secret = process.env.SEED_SECRET?.trim();
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
