import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createPending2FaToken, PENDING_2FA_COOKIE } from "@/lib/pending-2fa-token";
import { createSessionToken, SESSION_COOKIE_NAME, sessionMaxAgeSeconds } from "@/lib/session-token";
import { roleMustUse2Fa } from "@/lib/totp-auth";

const loginSchema = z.object({
  identifier: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = loginSchema.parse(body);
    const raw = identifier.trim();
    const emailLower = raw.includes("@") ? raw.toLowerCase() : null;

    const user = emailLower
      ? await prisma.user.findFirst({
          where: { email: emailLower },
        })
      : await prisma.user.findFirst({
          where: {
            organizationId: process.env.DEFAULT_ORGANIZATION_ID ?? "000000000000000000000001",
            username: raw.toLowerCase(),
          },
        });

    if (!user?.passwordHash) {
      return NextResponse.json(
        {
          message:
            "Compte introuvable ou mot de passe non défini. Un administrateur doit définir un mot de passe, ou exécutez le seed avec SEED_DEMO_PASSWORD.",
        },
        { status: 401 },
      );
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json({ message: "Identifiant ou mot de passe incorrect." }, { status: 401 });
    }

    if (user.active === false) {
      return NextResponse.json({ message: "Ce compte est désactivé. Contactez un administrateur." }, { status: 403 });
    }

    if (roleMustUse2Fa(user.role, user.twoFactorEnabled)) {
      if (!user.totpSecret) {
        return NextResponse.json(
          {
            message:
              "La double authentification est obligatoire pour votre profil. Configurez-la depuis Profil → Sécurité 2FA.",
            needsTwoFactorSetup: true,
          },
          { status: 403 },
        );
      }
      const pending = await createPending2FaToken(user.id);
      const res = NextResponse.json({
        needsTwoFactor: true,
        pendingToken: pending,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      });
      res.cookies.set(PENDING_2FA_COOKIE, pending, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 300,
      });
      return res;
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

    return res;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Requête invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Échec de la connexion." }, { status: 500 });
  }
}
