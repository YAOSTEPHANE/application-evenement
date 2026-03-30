import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const updateEventSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  clientName: z.string().min(2).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  ownerId: z.string().min(10).optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payload = updateEventSchema.parse(body);
    const { organizationId } = await getRequestContext();

    const existing = await prisma.event.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Événement introuvable" }, { status: 404 });
    }

    const startsAt = payload.startsAt ?? existing.startsAt;
    const endsAt = payload.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      return NextResponse.json(
        { message: "La date de fin doit être supérieure à la date de début." },
        { status: 400 },
      );
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        name: payload.name ?? existing.name,
        location: payload.location ?? existing.location,
        clientName: payload.clientName ?? existing.clientName,
        startsAt,
        endsAt,
        ownerId: payload.ownerId ?? existing.ownerId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier l'événement" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { organizationId } = await getRequestContext();

    const existing = await prisma.event.findFirst({
      where: { id, organizationId },
      include: { eventItems: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "Événement introuvable" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const allocation of existing.eventItems) {
        await tx.item.update({
          where: { id: allocation.itemId },
          data: {
            allocatedQty: { decrement: allocation.quantity },
            availableQty: { increment: allocation.quantity },
          },
        });
      }

      await tx.event.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Impossible de supprimer l'événement" }, { status: 500 });
  }
}

