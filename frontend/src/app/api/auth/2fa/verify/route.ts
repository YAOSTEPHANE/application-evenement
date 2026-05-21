import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  createPending2FaToken,
  PENDING_2FA_COOKIE,
  verifyPending2FaToken,
} from "@/lib/pending-2fa-token";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionMaxAgeSeconds,
} from "@/lib/session-token";
import { verifyTotpCode } from "@/lib/totp-auth";

const bodySchema = z.object({
  code: z.string().min(6).max(8),
  pendingToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const cookieHeader = request.headers.get("cookie");
    let pending =
      body.pendingToken ??
      cookieHeader
        ?.split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${PENDING_2FA_COOKIE}=`))
        ?.split("=")[1];

    if (pending) {
      pending = decodeURIComponent(pending);
    }
    if (!pending) {
      return NextResponse.json({ message: "Session 2FA expirée" }, { status: 401 });
    }

    const userId = await verifyPending2FaToken(pending);
    if (!userId) {
      return NextResponse.json({ message: "Session 2FA expirée" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        totpSecret: true,
        twoFactorEnabled: true,
        active: true,
        fullName: true,
        email: true,
        username: true,
        avatarUrl: true,
      },
    });
    if (!user?.active || !user.totpSecret) {
      return NextResponse.json({ message: "Compte invalide" }, { status: 403 });
    }

    const valid = await verifyTotpCode(user.totpSecret, body.code);
    if (!valid) {
      return NextResponse.json({ message: "Code TOTP incorrect" }, { status: 401 });
    }

    const token = await createSessionToken(user.id, user.organizationId, user.role, true);
    const res = NextResponse.json({
      sessionToken: token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionMaxAgeSeconds(),
    });
    res.cookies.set(PENDING_2FA_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Code invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Vérification impossible" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}
