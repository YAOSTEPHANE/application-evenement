import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.email().optional(),
  avatarUrl: z.url().nullable().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
});

export async function GET() {
  const { organizationId, actorId } = await getRequestContext();

  if (!actorId) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const profile = await prisma.user.findFirst({
    where: { id: actorId, organizationId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Profil introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    avatarUrl: profile.avatarUrl ?? null,
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const payload = updateProfileSchema.parse(body);
    const { organizationId, actorId } = await getRequestContext();

    if (!actorId) {
      return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
    }

    const existing = await prisma.user.findFirst({
      where: { id: actorId, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Profil introuvable" }, { status: 404 });
    }

    let nextPasswordHash = existing.passwordHash;
    if (payload.newPassword !== undefined) {
      if (existing.passwordHash) {
        if (!payload.currentPassword) {
          return NextResponse.json(
            { message: "Le mot de passe actuel est requis." },
            { status: 400 },
          );
        }
        const matches = await bcrypt.compare(payload.currentPassword, existing.passwordHash);
        if (!matches) {
          return NextResponse.json(
            { message: "Mot de passe actuel incorrect." },
            { status: 409 },
          );
        }
      }
      nextPasswordHash = await bcrypt.hash(payload.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: payload.fullName ?? existing.fullName,
        email: payload.email?.toLowerCase() ?? existing.email,
        avatarUrl: payload.avatarUrl === undefined ? existing.avatarUrl : payload.avatarUrl,
        passwordHash: nextPasswordHash,
      },
    });

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      avatarUrl: updated.avatarUrl ?? null,
    });
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
    return NextResponse.json({ message: "Impossible de mettre à jour le profil" }, { status: 500 });
  }
}
