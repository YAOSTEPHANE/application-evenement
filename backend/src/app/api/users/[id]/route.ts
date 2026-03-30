import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  email: z.email().optional(),
  fullName: z.string().min(2).optional(),
  avatarUrl: z.url().nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  /** Réinitialisation du mot de passe (admin uniquement). */
  password: z.string().min(8).optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();

    const user = await prisma.user.findFirst({
      where: { id, organizationId },
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

    if (!user) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ message: "Impossible de charger l'utilisateur" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const body = await request.json();
    const payload = updateUserSchema.parse(body);
    const { organizationId, actorId, role: actorRole } = await getRequestContext();

    if (actorRole !== Role.ADMIN) {
      return NextResponse.json(
        { message: "Seuls les administrateurs peuvent modifier un utilisateur depuis cette API." },
        { status: 403 },
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }

    if (payload.username !== undefined) {
      const usernameLower = payload.username.trim().toLowerCase();
      const taken = await prisma.user.findFirst({
        where: {
          organizationId,
          username: usernameLower,
          NOT: { id },
        },
      });
      if (taken) {
        return NextResponse.json({ message: "Ce nom d’utilisateur est déjà pris." }, { status: 409 });
      }
    }

    if (payload.role !== undefined && payload.role !== existing.role) {
      const actor = await prisma.user.findFirst({
        where: { id: actorId, organizationId },
      });
      if (!actor || actor.role !== Role.ADMIN) {
        return NextResponse.json(
          { message: "Seul un administrateur peut modifier les rôles." },
          { status: 403 },
        );
      }
      if (id === actorId) {
        return NextResponse.json(
          { message: "Vous ne pouvez pas modifier votre propre rôle." },
          { status: 409 },
        );
      }
    }

    let nextPasswordHash = existing.passwordHash;
    if (payload.password !== undefined) {
      nextPasswordHash = await bcrypt.hash(payload.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        username:
          payload.username !== undefined ? payload.username.trim().toLowerCase() : existing.username,
        email: payload.email?.toLowerCase() ?? existing.email,
        fullName: payload.fullName ?? existing.fullName,
        avatarUrl: payload.avatarUrl === undefined ? existing.avatarUrl : payload.avatarUrl,
        role: payload.role ?? existing.role,
        passwordHash: nextPasswordHash,
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

    return NextResponse.json(user);
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

    return NextResponse.json({ message: "Impossible de mettre à jour l'utilisateur" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId, actorId, role: actorRole } = await getRequestContext();

    if (actorRole !== Role.ADMIN) {
      return NextResponse.json(
        { message: "Seuls les administrateurs peuvent supprimer un utilisateur." },
        { status: 403 },
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }

    if (id === actorId) {
      return NextResponse.json({ message: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 409 });
    }

    const adminCount = await prisma.user.count({
      where: { organizationId, role: Role.ADMIN },
    });

    if (existing.role === Role.ADMIN && adminCount <= 1) {
      return NextResponse.json(
        { message: "Impossible de supprimer le dernier administrateur." },
        { status: 409 },
      );
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Impossible de supprimer l'utilisateur" }, { status: 500 });
  }
}

