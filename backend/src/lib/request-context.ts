import { headers } from "next/headers";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";

const DEFAULT_ORGANIZATION_ID = "000000000000000000000001";

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export type RequestContext = {
  organizationId: string;
  actorId: string;
  role: Role | null;
  authMethod: "jwt" | "legacy" | "none";
};

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const token = parseCookie(h.get("cookie"), SESSION_COOKIE_NAME);
  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      return {
        organizationId: session.organizationId,
        actorId: session.userId,
        role: session.role,
        authMethod: "jwt",
      };
    }
  }

  const organizationId = h.get("x-organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const actorId = h.get("x-actor-id") ?? "";

  if (!actorId) {
    return {
      organizationId,
      actorId: "",
      role: null,
      authMethod: "none",
    };
  }

  const actor = await prisma.user.findFirst({
    where: { id: actorId, organizationId },
    select: { role: true },
  });

  return {
    organizationId,
    actorId,
    role: actor?.role ?? null,
    authMethod: "legacy",
  };
}
