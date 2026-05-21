import { MovementReason, MovementType, ReturnCondition, type Prisma } from "@prisma/client";
import { z } from "zod";

import { applyStockDelta, loadStockQuantities } from "@/lib/item-variant-helpers";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

export const movementCreateSchema = z
  .object({
    movementType: z.nativeEnum(MovementType),
    movementReason: z.nativeEnum(MovementReason).optional(),
    itemId: objectId,
    itemVariantId: objectId.optional(),
    eventId: objectId.optional(),
    quantity: z.number().int().positive(),
    returnCondition: z.nativeEnum(ReturnCondition).optional(),
    notes: z.string().max(500).optional(),
    fromWarehouseId: objectId.optional(),
    fromStorageZoneId: objectId.optional(),
    fromStorageLocationId: objectId.optional(),
    toWarehouseId: objectId.optional(),
    toStorageZoneId: objectId.optional(),
    toStorageLocationId: objectId.optional(),
    /** Inventaire : quantité comptée (ajustement = écart vs disponible). */
    countedQty: z.number().int().nonnegative().optional(),
    /** Bon signé justifiant le mouvement (principe directeur CDC). */
    stockDocumentId: objectId.optional(),
    cdcCorrection: z.boolean().optional(),
    cdcCorrectionNote: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === MovementType.TRANSFER) {
      if (!data.fromStorageLocationId || !data.toStorageLocationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Emplacement source et destination requis pour un transfert.",
          path: ["fromStorageLocationId"],
        });
      }
      if (data.fromStorageLocationId === data.toStorageLocationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Les emplacements source et destination doivent être différents.",
          path: ["toStorageLocationId"],
        });
      }
    }
    if (data.movementType === MovementType.ADJUSTMENT && data.countedQty === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indiquez la quantité comptée pour l'inventaire.",
        path: ["countedQty"],
      });
    }
  });

export type MovementCreateInput = z.infer<typeof movementCreateSchema>;

export type MovementUiType =
  | "Entrée"
  | "Sortie"
  | "Transfert"
  | "Ajustement"
  | "Perte/Casse"
  | "Retour";

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  PURCHASE: "Achat",
  CUSTOMER_RETURN: "Retour client",
  MANUFACTURING: "Fabrication",
  SALE: "Vente",
  RENTAL: "Location",
  EVENT: "Événement",
  INTERNAL_TRANSFER: "Transfert interne",
  PHYSICAL_INVENTORY: "Inventaire physique",
  DAMAGE: "Casse / dommage",
  OTHER: "Autre",
};

export function movementTypeToUi(type: MovementType): MovementUiType {
  switch (type) {
    case MovementType.INBOUND:
      return "Entrée";
    case MovementType.OUTBOUND:
      return "Sortie";
    case MovementType.TRANSFER:
      return "Transfert";
    case MovementType.ADJUSTMENT:
      return "Ajustement";
    case MovementType.LOSS:
      return "Perte/Casse";
    case MovementType.RETURN:
    default:
      return "Retour";
  }
}

export function defaultReasonForType(type: MovementType): MovementReason {
  switch (type) {
    case MovementType.INBOUND:
      return MovementReason.PURCHASE;
    case MovementType.OUTBOUND:
      return MovementReason.EVENT;
    case MovementType.TRANSFER:
      return MovementReason.INTERNAL_TRANSFER;
    case MovementType.ADJUSTMENT:
      return MovementReason.PHYSICAL_INVENTORY;
    case MovementType.LOSS:
      return MovementReason.DAMAGE;
    case MovementType.RETURN:
    default:
      return MovementReason.CUSTOMER_RETURN;
  }
}

export function reasonsForMovementType(type: MovementType): MovementReason[] {
  switch (type) {
    case MovementType.INBOUND:
      return [MovementReason.PURCHASE, MovementReason.CUSTOMER_RETURN, MovementReason.MANUFACTURING, MovementReason.OTHER];
    case MovementType.OUTBOUND:
      return [MovementReason.SALE, MovementReason.RENTAL, MovementReason.EVENT, MovementReason.OTHER];
    case MovementType.TRANSFER:
      return [MovementReason.INTERNAL_TRANSFER];
    case MovementType.ADJUSTMENT:
      return [MovementReason.PHYSICAL_INVENTORY, MovementReason.OTHER];
    case MovementType.LOSS:
      return [MovementReason.DAMAGE, MovementReason.OTHER];
    case MovementType.RETURN:
    default:
      return [MovementReason.CUSTOMER_RETURN];
  }
}

export function movementSignedQty(type: MovementType, quantity: number): number {
  switch (type) {
    case MovementType.INBOUND:
    case MovementType.RETURN:
      return quantity;
    case MovementType.OUTBOUND:
    case MovementType.LOSS:
      return -quantity;
    case MovementType.ADJUSTMENT:
    case MovementType.TRANSFER:
    default:
      return quantity;
  }
}

async function applyLocationTransfer(
  tx: Prisma.TransactionClient,
  organizationId: string,
  payload: MovementCreateInput,
) {
  const qty = payload.quantity;
  const from = await tx.locationStockBalance.findFirst({
    where: {
      storageLocationId: payload.fromStorageLocationId!,
      itemId: payload.itemId,
      itemVariantId: payload.itemVariantId ?? null,
      organizationId,
    },
  });
  if (!from || from.availableQty < qty) {
    throw new Error("Stock insuffisant à l'emplacement source");
  }

  await tx.locationStockBalance.update({
    where: { id: from.id },
    data: {
      availableQty: from.availableQty - qty,
      systemQty: Math.max(0, from.systemQty - qty),
      physicalQty: Math.max(0, from.physicalQty - qty),
    },
  });

  const toExisting = await tx.locationStockBalance.findFirst({
    where: {
      storageLocationId: payload.toStorageLocationId!,
      itemId: payload.itemId,
      itemVariantId: payload.itemVariantId ?? null,
    },
  });

  if (toExisting) {
    await tx.locationStockBalance.update({
      where: { id: toExisting.id },
      data: {
        availableQty: toExisting.availableQty + qty,
        systemQty: toExisting.systemQty + qty,
        physicalQty: toExisting.physicalQty + qty,
      },
    });
  } else {
    const toLoc = await tx.storageLocation.findFirst({
      where: { id: payload.toStorageLocationId!, organizationId },
    });
    if (!toLoc) {
      throw new Error("Emplacement destination introuvable");
    }
    await tx.locationStockBalance.create({
      data: {
        organizationId,
        itemId: payload.itemId,
        itemVariantId: payload.itemVariantId ?? null,
        warehouseId: toLoc.warehouseId,
        storageZoneId: toLoc.storageZoneId,
        storageLocationId: toLoc.id,
        availableQty: qty,
        systemQty: qty,
        physicalQty: qty,
        reservedQty: 0,
        inTransitQty: 0,
      },
    });
  }
}

export async function executeStockMovement(
  tx: Prisma.TransactionClient,
  organizationId: string,
  payload: MovementCreateInput,
) {
  const stock = await loadStockQuantities(
    tx,
    organizationId,
    payload.itemId,
    payload.itemVariantId,
  );
  if (!stock) {
    throw new Error("Stock introuvable");
  }

  const type = payload.movementType;
  const qty = payload.quantity;

  if (type === MovementType.OUTBOUND) {
    if (stock.availableQty < qty) {
      throw new Error("Stock disponible insuffisant");
    }
    const reason = payload.movementReason ?? MovementReason.EVENT;
    if (reason === MovementReason.EVENT || payload.eventId) {
      await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
        available: -qty,
        allocated: qty,
      });
    } else {
      await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
        available: -qty,
        total: -qty,
      });
    }
    return;
  }

  if (type === MovementType.INBOUND || type === MovementType.RETURN) {
    const reason = payload.movementReason ?? defaultReasonForType(type);
    if (type === MovementType.RETURN || reason === MovementReason.CUSTOMER_RETURN) {
      const cond = payload.returnCondition ?? ReturnCondition.OK;
      const delta: { allocated: number; available?: number; repair?: number; total?: number } = {
        allocated: -qty,
      };
      if (cond === ReturnCondition.OK) {
        delta.available = qty;
      } else if (cond === ReturnCondition.DAMAGED) {
        delta.repair = qty;
      } else if (cond === ReturnCondition.MISSING) {
        delta.total = -qty;
      }
      await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, delta);
    } else {
      await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
        available: qty,
        total: qty,
      });
    }
    return;
  }

  if (type === MovementType.LOSS) {
    if (stock.availableQty < qty) {
      throw new Error("Stock disponible insuffisant");
    }
    await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
      available: -qty,
      total: -qty,
    });
    return;
  }

  if (type === MovementType.ADJUSTMENT) {
    const delta =
      payload.countedQty !== undefined
        ? payload.countedQty - stock.availableQty
        : payload.quantity;
    if (delta === 0) {
      return;
    }
    await applyStockDelta(tx, organizationId, payload.itemId, payload.itemVariantId, {
      available: delta,
      total: delta,
    });
    return;
  }

  if (type === MovementType.TRANSFER) {
    await applyLocationTransfer(tx, organizationId, payload);
  }
}

export const movementListInclude = {
  item: { select: { id: true, name: true, reference: true, emoji: true } },
  itemVariant: { select: { id: true, reference: true, label: true, size: true, color: true } },
  event: { select: { id: true, name: true } },
  actor: { select: { id: true, fullName: true } },
} as const;

export async function fetchMovementsForOrg(
  organizationId: string,
  options?: { type?: MovementType; limit?: number },
) {
  return prisma.stockMovement.findMany({
    where: {
      organizationId,
      ...(options?.type ? { movementType: options.type } : {}),
    },
    include: movementListInclude,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 500,
  });
}
