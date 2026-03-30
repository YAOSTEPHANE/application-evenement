import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * CORS : le frontend (autre origine, ex. Vercel) appelle ce backend.
 * Sur Vercel : définir CORS_ALLOWED_ORIGINS=https://ton-frontend.vercel.app
 * (virgule pour plusieurs URL, ex. preview + production).
 */
function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = parseAllowedOrigins();

  if (origin && allowed.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, x-organization-id, x-actor-id"
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

function originForbidden(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  const allowed = parseAllowedOrigins();
  return allowed.length > 0 && !allowed.includes(origin);
}

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    if (originForbidden(request)) {
      return new NextResponse(null, { status: 403 });
    }
    const res = new NextResponse(null, { status: 204 });
    return applyCors(request, res);
  }

  if (originForbidden(request)) {
    return NextResponse.json(
      { message: "Origine non autorisée (CORS)" },
      { status: 403 }
    );
  }

  const res = NextResponse.next();
  return applyCors(request, res);
}

export const config = {
  matcher: "/api/:path*",
};
