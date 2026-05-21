import { MovementType, ReturnCondition } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { applyStockDelta, loadStockQuantities } from "@/lib/item-variant-helpers";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const createMovementSchema = z.object({
  movementType: z.nativeEnum(MovementType),
  itemId: objectId,
  itemVariantId: objectId.optional(),
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
      itemVariant: { select: { id: true, reference: true, label: true, size: true, color: true } },
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

    const result = await prisma.$transaction(async (tx) => {
      const stock = await loadStockQuantities(
        tx,
        organizationId,
        payload.itemId,
        payload.itemVariantId,
      );

      if (!stock) {
        return {
          response: NextResponse.json({ message: "Stock introuvable" }, { status: 404 }),
        };
      }

      if (payload.movementType === MovementType.OUTBOUND) {
        if (stock.availableQty < payload.quantity) {
          return {
            response: NextResponse.json(
              { message: "Stock disponible insuffisant" },
              { status: 409 },
            ),
          };
        }

        await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
          available: -payload.quantity,
          allocated: payload.quantity,
        });
      }

      if (payload.movementType === MovementType.RETURN) {
        const delta: { allocated: number; available?: number; repair?: number; total?: number } = {
          allocated: -payload.quantity,
        };

        if (payload.returnCondition === ReturnCondition.OK) {
          delta.available = payload.quantity;
        } else if (payload.returnCondition === ReturnCondition.DAMAGED) {
          delta.repair = payload.quantity;
        } else if (payload.returnCondition === ReturnCondition.MISSING) {
          delta.total = -payload.quantity;
        }

        await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, delta);
      }

      if (payload.movementType === MovementType.ADJUSTMENT) {
        await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
          total: payload.quantity,
          available: payload.quantity,
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
          itemVariantId: payload.itemVariantId,
          eventId: payload.eventId,
          actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: `stock.${payload.movementType.toLowerCase()}`,
          targetType: payload.itemVariantId ? "itemVariant" : "item",
          targetId: payload.itemVariantId ?? payload.itemId,
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
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Impossible d'enregistrer le mouvement" },
      { status: 500 },
    );
  }
}
