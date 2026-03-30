import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const createUserSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, point, tiret ou underscore uniquement"),
  email: z.email(),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export async function GET() {
  const { organizationId, actorId, role } = await getRequestContext();

  if (!actorId) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  try {
    const { organizationId, actorId, role } = await getRequestContext();

    if (!actorId || role !== Role.ADMIN) {
      return NextResponse.json(
        { message: "Seuls les administrateurs peuvent créer des utilisateurs." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const payload = createUserSchema.parse(body);

    const usernameLower = payload.username.trim().toLowerCase();

    const dupUser = await prisma.user.findFirst({
      where: {
        organizationId,
        username: usernameLower,
      },
    });
    if (dupUser) {
      return NextResponse.json({ message: "Ce nom d’utilisateur est déjà pris." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        username: usernameLower,
        email: payload.email.toLowerCase(),
        fullName: payload.fullName,
        role: payload.role,
        organizationId,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "Cet email est déjà utilisé." }, { status: 409 });
    }

    return NextResponse.json({ message: "Impossible de créer l'utilisateur" }, { status: 500 });
  }
}
