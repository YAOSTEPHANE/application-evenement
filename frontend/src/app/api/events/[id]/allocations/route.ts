import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const allocationSchema = z.object({
  itemId: objectId,
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
    const { organizationId } = await getRequestContext();

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      include: { eventItems: true },
    });

    if (!event) {
      return NextResponse.json({ message: "Événement introuvable" }, { status: 404 });
    }

    const existingQty =
      event.eventItems.find((row) => row.itemId === payload.itemId)?.quantity ?? 0;

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
        if (allocation.itemId === payload.itemId) {
          pendingOnOverlaps += allocation.quantity;
        }
      }
    }

    const item = await prisma.item.findFirst({
      where: { id: payload.itemId, organizationId },
    });

    if (!item) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    const remaining = item.availableQty - pendingOnOverlaps;
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
      if (existingQty > 0) {
        await tx.eventItem.updateMany({
          where: { eventId, itemId: payload.itemId },
          data: { quantity: payload.quantity },
        });
      } else {
        await tx.eventItem.create({
          data: {
            eventId,
            itemId: payload.itemId,
            quantity: payload.quantity,
          },
        });
      }

      if (delta !== 0) {
        await tx.item.update({
          where: { id: payload.itemId },
          data: {
            availableQty: { decrement: delta },
            allocatedQty: { increment: delta },
          },
        });
      }

      return tx.eventItem.findFirst({
        where: { eventId, itemId: payload.itemId },
      });
    });

    return NextResponse.json(eventItem, { status: 201 });
  } catch (error) {
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
