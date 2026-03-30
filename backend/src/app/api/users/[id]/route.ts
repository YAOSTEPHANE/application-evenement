import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  email: z.email().optional(),
  fullName: z.string().min(2).optional(),
  avatarUrl: z.url().nullable().optional(),
  role: z.nativeEnum(Role).optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payload = updateUserSchema.parse(body);
    const { organizationId, actorId } = await getRequestContext();

    const existing = await prisma.user.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }

    if (payload.role !== undefined) {
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        email: payload.email?.toLowerCase() ?? existing.email,
        fullName: payload.fullName ?? existing.fullName,
        avatarUrl: payload.avatarUrl === undefined ? existing.avatarUrl : payload.avatarUrl,
        role: payload.role ?? existing.role,
      },
      select: {
        id: true,
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
    const { organizationId, actorId } = await getRequestContext();

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

