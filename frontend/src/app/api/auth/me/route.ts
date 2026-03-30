import fs from "node:fs";
import path from "node:path";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";
import { SESSION_COOKIE_NAME } from "@/lib/session-token";

// #region agent log
function agentLogMe(hypothesisId: string, data: Record<string, unknown>): void {
  const payload = {
    sessionId: "6cb17d",
    location: "frontend/src/app/api/auth/me/route.ts",
    message: "me route context",
    hypothesisId,
    timestamp: Date.now(),
    runId: "pre-fix",
    data,
  };
  try {
    const logPath = path.join(process.cwd(), "..", "debug-6cb17d.log");
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // ignore
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

export async function GET() {
  const h = await headers();
  const cookieHeader = h.get("cookie");
  const hasSessionCookie = Boolean(cookieHeader?.includes(`${SESSION_COOKIE_NAME}=`));
  const { organizationId, actorId, authMethod } = await getRequestContext();

  // #region agent log
  agentLogMe("H3", {
    hasSessionCookie,
    authMethod,
    actorIdPresent: Boolean(actorId),
    willReturn401: !actorId || authMethod === "none",
  });
  // #endregion

  if (!actorId || authMethod === "none") {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: actorId, organizationId },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      avatarUrl: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "Utilisateur introuvable." }, { status: 401 });
  }

  return NextResponse.json(user);
}
