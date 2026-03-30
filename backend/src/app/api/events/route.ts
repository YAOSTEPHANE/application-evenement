import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const createEventSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  clientName: z.string().min(2),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  ownerId: z.string().min(10),
  allocations: z
    .array(
      z.object({
        itemId: z.string().min(10),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const events = await prisma.event.findMany({
    where: { organizationId },
    include: {
      owner: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      eventItems: {
        include: {
          item: {
            select: { id: true, name: true, reference: true },
          },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createEventSchema.parse(body);
    const { organizationId } = await getRequestContext();

    if (payload.endsAt <= payload.startsAt) {
      return NextResponse.json(
        { message: "La date de fin doit être supérieure à la date de début." },
        { status: 400 }
      );
    }

    const requestedItemIds = payload.allocations.map((a) => a.itemId);
    const overlappingEvents = await prisma.event.findMany({
      where: {
        organizationId,
        startsAt: { lte: payload.endsAt },
        endsAt: { gte: payload.startsAt },
      },
      include: { eventItems: true },
    });

    const pendingByItem = new Map<string, number>();

    for (const event of overlappingEvents) {
      for (const allocation of event.eventItems) {
        if (requestedItemIds.includes(allocation.itemId)) {
          pendingByItem.set(
            allocation.itemId,
            (pendingByItem.get(allocation.itemId) ?? 0) + allocation.quantity
          );
        }
      }
    }

    const stockItems = await prisma.item.findMany({
      where: {
        organizationId,
        id: { in: requestedItemIds },
      },
    });

    const stockById = new Map(stockItems.map((item) => [item.id, item]));

    for (const allocation of payload.allocations) {
      const item = stockById.get(allocation.itemId);
      if (!item) {
        return NextResponse.json(
          { message: `Article introuvable: ${allocation.itemId}` },
          { status: 404 }
        );
      }

      const alreadyAllocated = pendingByItem.get(allocation.itemId) ?? 0;
      const remaining = item.totalQuantity - alreadyAllocated;

      if (allocation.quantity > remaining) {
        return NextResponse.json(
          {
            message: `Conflit de disponibilité sur ${item.name}. Quantité demandée: ${allocation.quantity}, disponible: ${remaining}.`,
          },
          { status: 409 }
        );
      }
    }

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          name: payload.name,
          location: payload.location,
          clientName: payload.clientName,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          ownerId: payload.ownerId,
          organizationId,
        },
      });

      for (const allocation of payload.allocations) {
        await tx.eventItem.create({
          data: {
            eventId: created.id,
            itemId: allocation.itemId,
            quantity: allocation.quantity,
          },
        });

        await tx.item.update({
          where: { id: allocation.itemId },
          data: {
            availableQty: { decrement: allocation.quantity },
            allocatedQty: { increment: allocation.quantity },
          },
        });
      }

      return created;
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Impossible de créer l'événement" },
      { status: 500 }
    );
  }
}
