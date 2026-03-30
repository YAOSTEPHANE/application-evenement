import { ItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const updateItemSchema = z.object({
  name: z.string().min(2).optional(),
  reference: z.string().min(2).optional(),
  categoryId: objectId.optional(),
  photoUrl: z.url().optional().nullable(),
  unitValue: z.number().nonnegative().optional(),
  totalQuantity: z.number().int().nonnegative().optional(),
  minThreshold: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(ItemStatus).optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();

    const item = await prisma.item.findFirst({
      where: { id, organizationId },
      // Évite de résoudre la relation `category` (voir GET /api/items).
      select: {
        id: true,
        name: true,
        reference: true,
        photoUrl: true,
        unitValue: true,
        totalQuantity: true,
        availableQty: true,
        allocatedQty: true,
        minThreshold: true,
        status: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      ...item,
      isCritical: item.availableQty <= item.minThreshold,
    });
  } catch {
    return NextResponse.json({ message: "Impossible de charger l'article" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const body = await request.json();
    const payload = updateItemSchema.parse(body);
    const { organizationId } = await getRequestContext();

    const existing = await prisma.item.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    const nextTotal = payload.totalQuantity ?? existing.totalQuantity;
    const minRequired = (existing.allocatedQty ?? 0) + (existing.repairQty ?? 0);
    if (nextTotal < minRequired) {
      return NextResponse.json(
        {
          message:
            "La quantité totale ne peut pas être inférieure à la quantité déjà allouée/en réparation.",
        },
        { status: 409 },
      );
    }

    const computedAvailable = nextTotal - existing.allocatedQty - existing.repairQty;

    const item = await prisma.item.update({
      where: { id },
      data: {
        name: payload.name ?? existing.name,
        reference: payload.reference ?? existing.reference,
        categoryId: payload.categoryId ?? existing.categoryId,
        photoUrl:
          payload.photoUrl === null ? null : payload.photoUrl === undefined ? existing.photoUrl : payload.photoUrl,
        unitValue: payload.unitValue ?? existing.unitValue,
        totalQuantity: nextTotal,
        availableQty: computedAvailable,
        minThreshold: payload.minThreshold ?? existing.minThreshold,
        status: payload.status ?? existing.status,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier l'article" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();

    const existing = await prisma.item.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { eventItems: true, movements: true } } },
    });

    if (!existing) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    if (existing._count.eventItems > 0 || existing._count.movements > 0) {
      return NextResponse.json(
        { message: "Impossible de supprimer un article qui possède déjà des mouvements ou affectations." },
        { status: 409 },
      );
    }

    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Impossible de supprimer l'article" }, { status: 500 });
  }
}

