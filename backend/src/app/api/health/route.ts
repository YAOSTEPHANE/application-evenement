import { NextResponse } from "next/server";

import { hasAuthJwtSecretConfigured } from "@/lib/auth-env";
import { prisma } from "@/lib/prisma";

/** Diagnostic déploiement (Vercel) — ne expose pas de secrets. */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasJwtSecret = hasAuthJwtSecretConfigured();

  let databaseReachable = false;
  if (hasDatabaseUrl) {
    try {
      await prisma.$runCommandRaw({ ping: 1 });
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const ok = hasDatabaseUrl && hasJwtSecret && databaseReachable;

  return NextResponse.json(
    {
      ok,
      checks: {
        databaseUrl: hasDatabaseUrl,
        jwtSecret: hasJwtSecret,
        databaseReachable,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
