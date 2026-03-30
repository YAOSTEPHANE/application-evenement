import { MovementType, ReturnCondition } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const createMovementSchema = z.object({
  movementType: z.nativeEnum(MovementType),
  itemId: objectId,
  eventId: objectId.optional(),
  quantity: z.number().int().positive(),
  returnCondition: z.nativeEnum(ReturnCondition).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const movements = await prisma.stockMovement.findMany({
    where: { organizationId },
    include: {
      item: { select: { id: true, name: true, reference: true } },
      event: { select: { id: true, name: true } },
      actor: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(movements);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createMovementSchema.parse(body);
    const { organizationId, actorId } = await getRequestContext();

    const item = await prisma.item.findFirst({
      where: {
        id: payload.itemId,
        organizationId,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (payload.movementType === MovementType.OUTBOUND) {
        if (item.availableQty < payload.quantity) {
          return {
            response: NextResponse.json(
              { message: "Stock disponible insuffisant" },
              { status: 409 }
            ),
          };
        }

        await tx.item.update({
          where: { id: item.id },
          data: {
            availableQty: { decrement: payload.quantity },
            allocatedQty: { increment: payload.quantity },
          },
        });
      }

      if (payload.movementType === MovementType.RETURN) {
        await tx.item.update({
          where: { id: item.id },
          data: {
            allocatedQty: { decrement: payload.quantity },
            availableQty:
              payload.returnCondition === ReturnCondition.OK
                ? { increment: payload.quantity }
                : undefined,
            repairQty:
              payload.returnCondition === ReturnCondition.DAMAGED
                ? { increment: payload.quantity }
                : undefined,
          },
        });
      }

      if (payload.movementType === MovementType.ADJUSTMENT) {
        await tx.item.update({
          where: { id: item.id },
          data: {
            totalQuantity: { increment: payload.quantity },
            availableQty: { increment: payload.quantity },
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          movementType: payload.movementType,
          quantity: payload.quantity,
          returnCondition: payload.returnCondition,
          notes: payload.notes,
          organizationId,
          itemId: payload.itemId,
          eventId: payload.eventId,
          actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: `stock.${payload.movementType.toLowerCase()}`,
          targetType: "item",
          targetId: payload.itemId,
          payload: JSON.stringify(payload),
          actorId,
          organizationId,
        },
      });

      return { movement };
    });

    if ("response" in result) {
      return result.response;
    }

    return NextResponse.json(result.movement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Impossible d'enregistrer le mouvement" },
      { status: 500 }
    );
  }
}
