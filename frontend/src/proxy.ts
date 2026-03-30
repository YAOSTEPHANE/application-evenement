import fs from "node:fs";
import path from "node:path";

import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getJwtSecretKey, SESSION_COOKIE_NAME } from "@/lib/session-token";

// #region agent log
function agentLogProxy(hypothesisId: string, message: string, data: Record<string, unknown>): void {
  const payload = {
    sessionId: "6cb17d",
    location: "frontend/src/proxy.ts",
    message,
    hypothesisId,
    timestamp: Date.now(),
    runId: "pre-fix",
    data,
  };
  try {
    const logPath = path.join(process.cwd(), "..", "debug-6cb17d.log");
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // ignore (ex. Vercel FS read-only hors cwd)
  }
  void fetch("http://127.0.0.1:27772/ingest/9a36c12d-ef1f-4d76-9ab2-d5fb877f7df6", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "6cb17d",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

/**
 * Next.js détecte `middleware.ts` et `proxy.ts` comme deux façons concurrentes de faire du “edge handling”.
 * On garde donc `proxy.ts` uniquement, en y mettant toute la logique (auth + CORS).
 */

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

function applyApiCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = parseAllowedOrigins();

  const allowOrigin =
    process.env.NODE_ENV === "development" && origin
      ? origin
      : origin && allowed.includes(origin)
        ? origin
        : undefined;

  if (allowOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, x-organization-id, x-actor-id, Cookie",
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

/**
 * Même origine (monolithe Next sur Vercel, etc.) : le navigateur envoie Origin = l’URL du site,
 * qui doit être autorisée même si CORS_ALLOWED_ORIGINS n’est pas encore configuré (sinon 403 sur /api/auth/login en prod).
 */
function isSameOriginAsRequest(request: NextRequest, origin: string): boolean {
  try {
    const originUrl = new URL(origin);
    const forwarded = request.headers.get("x-forwarded-host");
    const rawHost =
      (forwarded?.split(",")[0]?.trim() ?? request.headers.get("host") ?? "").split(":")[0];
    const reqHostname = request.nextUrl.hostname;
    const target = rawHost || reqHostname;
    return Boolean(target) && originUrl.hostname === target;
  } catch {
    return false;
  }
}

function originForbidden(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return false;
  }
  if (isSameOriginAsRequest(request, origin)) {
    return false;
  }
  const allowed = parseAllowedOrigins();
  return allowed.length > 0 && !allowed.includes(origin);
}

function isPublicApiPath(pathname: string): boolean {
  if (pathname === "/api/auth/login") return true;
  if (pathname === "/api/auth/logout") return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/api/setup/seed")) return true;
  return false;
}

function legacyHeadersAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.ALLOW_LEGACY_API_HEADERS === "true";
  }
  return process.env.ALLOW_LEGACY_API_HEADERS !== "false";
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  try {
    await jwtVerify(token, getJwtSecretKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname === "/api/auth/login" || pathname === "/api/auth/me") {
    const origin = request.headers.get("origin");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");
    const nextHostname = request.nextUrl.hostname;
    let sameOrigin = false;
    if (origin) {
      try {
        sameOrigin = isSameOriginAsRequest(request, origin);
      } catch {
        sameOrigin = false;
      }
    }
    const forbidden = originForbidden(request);
    const allowed = parseAllowedOrigins();
    // #region agent log
    agentLogProxy("H1", "proxy auth path cors gate", {
      pathname,
      method: request.method,
      originPresent: Boolean(origin),
      originHost: origin ? (() => {
        try {
          return new URL(origin).hostname;
        } catch {
          return "(parse error)";
        }
      })() : null,
      forwardedHost,
      host,
      nextHostname,
      sameOrigin,
      originForbidden: forbidden,
      allowedOriginsCount: allowed.length,
      corsEnvSet: Boolean(process.env.CORS_ALLOWED_ORIGINS?.trim()),
      nodeEnv: process.env.NODE_ENV,
    });
    // #endregion
  }

  if (request.method === "OPTIONS") {
    if (originForbidden(request)) {
      return new NextResponse(null, { status: 403 });
    }
    const res = new NextResponse(null, { status: 204 });
    return applyApiCors(request, res);
  }

  if (originForbidden(request)) {
    const res = NextResponse.json(
      { message: "Origine non autorisée (CORS)" },
      { status: 403 },
    );
    return applyApiCors(request, res);
  }

  let res: NextResponse;
  if (isPublicApiPath(pathname)) {
    res = NextResponse.next();
  } else {
    const okSession = await hasValidSession(request);
    const okLegacy =
      legacyHeadersAllowed(request) && Boolean(request.headers.get("x-actor-id"));

    if (okSession || okLegacy) {
      res = NextResponse.next();
    } else {
      res = NextResponse.json({ message: "Non authentifié." }, { status: 401 });
    }
  }

  return applyApiCors(request, res);
}

export const config = {
  matcher: "/api/:path*",
};
