import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertMovementCompliesWithDirectingPrinciple } from "@/lib/cdc-directing-principle";
import {
  executeStockMovement,
  fetchMovementsForOrg,
  movementCreateSchema,
  movementListInclude,
} from "@/lib/movement-helpers";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET(request: Request) {
  const { organizationId } = await getRequestContext();
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "500", 10) || 500, 1000);

  let typeFilter: MovementType | undefined;
  if (typeParam && Object.values(MovementType).includes(typeParam as MovementType)) {
    typeFilter = typeParam as MovementType;
  }

  const movements = await fetchMovementsForOrg(organizationId, {
    type: typeFilter,
    limit,
  });

  const locationIds = new Set<string>();
  for (const m of movements) {
    if (m.fromStorageLocationId) {
      locationIds.add(m.fromStorageLocationId);
    }
    if (m.toStorageLocationId) {
      locationIds.add(m.toStorageLocationId);
    }
  }

  const locations =
    locationIds.size > 0
      ? await prisma.storageLocation.findMany({
          where: { id: { in: [...locationIds] }, organizationId },
          select: { id: true, code: true, label: true, hierarchyCoordinate: true },
        })
      : [];
  const locMap = new Map(locations.map((l) => [l.id, l]));

  const enriched = movements.map((m) => ({
    ...m,
    fromLocation: m.fromStorageLocationId ? locMap.get(m.fromStorageLocationId) ?? null : null,
    toLocation: m.toStorageLocationId ? locMap.get(m.toStorageLocationId) ?? null : null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = movementCreateSchema.parse(body);
    const { organizationId, actorId, role } = await getRequestContext();

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
      try {
        await assertMovementCompliesWithDirectingPrinciple(
          tx,
          organizationId,
          role ?? "VIEWER",
          payload,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Mouvement refusé";
        const code =
          e instanceof Error && "code" in e
            ? (e as Error & { code?: string }).code
            : undefined;
        return {
          response: NextResponse.json({ message: msg, code }, { status: 422 }),
        };
      }

      try {
        await executeStockMovement(tx, organizationId, payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Mouvement impossible";
        const status = msg.includes("insuffisant") ? 409 : 400;
        return { response: NextResponse.json({ message: msg }, { status }) };
      }

      let fromWarehouseId = payload.fromWarehouseId;
      let fromStorageZoneId = payload.fromStorageZoneId;
      let toWarehouseId = payload.toWarehouseId;
      let toStorageZoneId = payload.toStorageZoneId;

      if (payload.fromStorageLocationId) {
        const fromLoc = await tx.storageLocation.findFirst({
          where: { id: payload.fromStorageLocationId, organizationId },
        });
        if (fromLoc) {
          fromWarehouseId = fromLoc.warehouseId;
          fromStorageZoneId = fromLoc.storageZoneId;
        }
      }
      if (payload.toStorageLocationId) {
        const toLoc = await tx.storageLocation.findFirst({
          where: { id: payload.toStorageLocationId, organizationId },
        });
        if (toLoc) {
          toWarehouseId = toLoc.warehouseId;
          toStorageZoneId = toLoc.storageZoneId;
        }
      }

      const movement = await tx.stockMovement.create({
        data: {
          movementType: payload.movementType,
          movementReason: payload.movementReason,
          quantity: payload.quantity,
          returnCondition: payload.returnCondition,
          notes: payload.notes,
          organizationId,
          itemId: payload.itemId,
          itemVariantId: payload.itemVariantId,
          eventId: payload.eventId,
          fromWarehouseId,
          fromStorageZoneId,
          fromStorageLocationId: payload.fromStorageLocationId,
          toWarehouseId,
          toStorageZoneId,
          toStorageLocationId: payload.toStorageLocationId,
          countedQty: payload.countedQty,
          stockDocumentId: payload.stockDocumentId,
          actorId,
        },
        include: movementListInclude,
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
