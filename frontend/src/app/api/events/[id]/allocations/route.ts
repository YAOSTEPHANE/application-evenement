
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { applyStockDelta, loadStockQuantities } from "@/lib/item-variant-helpers";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const allocationSchema = z.object({
  itemId: objectId,
  itemVariantId: objectId.optional(),
  quantity: z.number().int().positive(),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    if (!isValidMongoObjectId(eventId)) {
      return jsonInvalidObjectIdResponse();
    }

    const body = await request.json();
    const payload = allocationSchema.parse(body);
    const { organizationId } = await requireAuthenticatedContext();

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      include: { eventItems: true },
    });

    if (!event) {
      return NextResponse.json({ message: "Événement introuvable" }, { status: 404 });
    }

    const item = await prisma.item.findFirst({
      where: { id: payload.itemId, organizationId },
    });

    if (!item) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    if (item.hasVariants && !payload.itemVariantId) {
      return NextResponse.json(
        { message: "Sélectionnez une variante pour cet article." },
        { status: 400 },
      );
    }

    if (payload.itemVariantId) {
      const variant = await prisma.itemVariant.findFirst({
        where: { id: payload.itemVariantId, itemId: payload.itemId, organizationId },
      });
      if (!variant) {
        return NextResponse.json({ message: "Variante introuvable" }, { status: 404 });
      }
    }

    const matchAllocation = (row: { itemId: string; itemVariantId: string | null }) =>
      row.itemId === payload.itemId &&
      (row.itemVariantId ?? null) === (payload.itemVariantId ?? null);

    const existingQty = event.eventItems.find(matchAllocation)?.quantity ?? 0;

    const overlappingEvents = await prisma.event.findMany({
      where: {
        organizationId,
        id: { not: eventId },
        startsAt: { lte: event.endsAt },
        endsAt: { gte: event.startsAt },
      },
      include: { eventItems: true },
    });

    let pendingOnOverlaps = 0;
    for (const other of overlappingEvents) {
      for (const allocation of other.eventItems) {
        if (matchAllocation(allocation)) {
          pendingOnOverlaps += allocation.quantity;
        }
      }
    }

    const stock = await loadStockQuantities(
      prisma,
      organizationId,
      payload.itemId,
      payload.itemVariantId,
    );

    if (!stock) {
      return NextResponse.json({ message: "Stock introuvable" }, { status: 404 });
    }

    const remaining = stock.availableQty - pendingOnOverlaps;
    if (payload.quantity > remaining + existingQty) {
      return NextResponse.json(
        {
          message: `Stock insuffisant pour ${item.name}. Disponible: ${remaining + existingQty}, demandé: ${payload.quantity}.`,
        },
        { status: 409 },
      );
    }

    const delta = payload.quantity - existingQty;

    const eventItem = await prisma.$transaction(async (tx) => {
      const existingRow = event.eventItems.find(matchAllocation);

      if (existingRow) {
        await tx.eventItem.update({
          where: { id: existingRow.id },
          data: { quantity: payload.quantity },
        });
      } else {
        await tx.eventItem.create({
          data: {
            eventId,
            itemId: payload.itemId,
            itemVariantId: payload.itemVariantId ?? null,
            quantity: payload.quantity,
          },
        });
      }

      if (delta !== 0) {
        await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
          available: -delta,
          allocated: delta,
        });
      }

      return tx.eventItem.findFirst({
        where: {
          eventId,
          itemId: payload.itemId,
          itemVariantId: payload.itemVariantId ?? null,
        },
      });
    });

    return NextResponse.json(eventItem, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Impossible d'enregistrer l'affectation" },
      { status: 500 },
    );
  }
}
