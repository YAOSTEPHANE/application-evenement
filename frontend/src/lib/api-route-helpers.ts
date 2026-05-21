import { NextResponse } from "next/server";

import {
  IdempotencyError,
  replayOrRunIdempotent,
  type IdempotentResult,
} from "@/lib/api-idempotency";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import type { RequestContext } from "@/lib/request-context";

function toJsonResponse(result: IdempotentResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status });
}

function mapRouteError(error: unknown): NextResponse | null {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof SensitiveAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof IdempotencyError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return null;
}

/** POST authentifié avec idempotence optionnelle (mobile offline). */
export async function handleAuthenticatedIdempotentPost(
  request: Request,
  scope: string,
  handler: (ctx: RequestContext) => Promise<IdempotentResult>,
): Promise<NextResponse> {
  try {
    const ctx = await requireAuthenticatedContext();
    const result = await replayOrRunIdempotent(ctx.organizationId, request, scope, () =>
      handler(ctx),
    );
    return toJsonResponse(result);
  } catch (error) {
    const mapped = mapRouteError(error);
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}

/** POST sensible (2FA) + idempotence. */
export async function handleSensitiveIdempotentPost(
  request: Request,
  scope: string,
  handler: (ctx: RequestContext) => Promise<IdempotentResult>,
): Promise<NextResponse> {
  try {
    const ctx = await requireAuthenticatedContext();
    await assertSensitiveActionAllowed(ctx);
    const result = await replayOrRunIdempotent(ctx.organizationId, request, scope, () =>
      handler(ctx),
    );
    return toJsonResponse(result);
  } catch (error) {
    const mapped = mapRouteError(error);
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}
