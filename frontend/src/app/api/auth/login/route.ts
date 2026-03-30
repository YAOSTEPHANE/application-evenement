import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

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

    const token = await createSessionToken(user.id, user.organizationId, user.role);
    const res = NextResponse.json({
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
      maxAge: 60 * 60 * 24 * 7,
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
