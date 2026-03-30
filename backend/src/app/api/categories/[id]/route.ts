import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payload = updateCategorySchema.parse(body);
    const { organizationId } = await getRequestContext();

    const existing = await prisma.category.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Catégorie introuvable" }, { status: 404 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: payload.name ?? existing.name,
        slug: payload.slug?.toLowerCase() ?? existing.slug,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier la catégorie" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { organizationId } = await getRequestContext();

    const existing = await prisma.category.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      return NextResponse.json({ message: "Catégorie introuvable" }, { status: 404 });
    }

    if (existing._count.items > 0) {
      return NextResponse.json(
        { message: "Impossible de supprimer une catégorie contenant des articles." },
        { status: 409 },
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Impossible de supprimer la catégorie" }, { status: 500 });
  }
}

