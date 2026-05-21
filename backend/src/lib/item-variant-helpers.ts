import { ItemCondition, ItemStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { conditionToUi, syncStatusFromCondition } from "@/lib/item-helpers";
import {
  computeStockLevelStatus,
  isStockAlertStatus,
  stockLevelsFromDb,
  stockLevelsSchema,
  stockLevelsToDb,
} from "@/lib/stock-level-helpers";
import { ITEM_CONDITION } from "@/lib/item-shared";
import { isValidMongoObjectId } from "@/lib/mongo-id";

export const variantWriteSchema = z.object({
  id: z.string().optional(),
  reference: z.string().min(2).max(80),
  label: z.string().max(200).optional().nullable(),
  size: z.string().max(80).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  modelName: z.string().max(120).optional().nullable(),
  unitValue: z.number().nonnegative(),
  rentalPrice: z.number().nonnegative().optional().nullable(),
  salePrice: z.number().nonnegative().optional().nullable(),
  totalQuantity: z.number().int().nonnegative(),
  minThreshold: z.number().int().nonnegative().default(0),
  maxStockQty: z.number().int().nonnegative().default(0),
  safetyStockQty: z.number().int().nonnegative().default(0),
  optimalStockQty: z.number().int().nonnegative().default(0),
  alertThresholdQty: z.number().int().nonnegative().default(0),
  criticalThresholdQty: z.number().int().nonnegative().default(0),
  condition: z
    .enum([
      ITEM_CONDITION.NEW,
      ITEM_CONDITION.GOOD,
      ITEM_CONDITION.NEEDS_REPAIR,
      ITEM_CONDITION.OBSOLETE,
    ])
    .optional(),
  barcode: z.string().max(64).optional().nullable(),
  photoUrl: z.union([z.string().url().max(2048), z.literal("")]).optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const VARIANT_PUBLIC_SELECT = {
  id: true,
  itemId: true,
  reference: true,
  label: true,
  size: true,
  color: true,
  modelName: true,
  unitValue: true,
  rentalPrice: true,
  salePrice: true,
  totalQuantity: true,
  availableQty: true,
  allocatedQty: true,
  repairQty: true,
  minThreshold: true,
  maxStockQty: true,
  safetyStockQty: true,
  optimalStockQty: true,
  alertThresholdQty: true,
  criticalThresholdQty: true,
  condition: true,
  status: true,
  barcode: true,
  photoUrl: true,
  sortOrder: true,
} as const;

export type VariantWriteInput = z.infer<typeof variantWriteSchema>;

export function variantDisplayLabel(v: {
  label?: string | null;
  size?: string | null;
  color?: string | null;
  modelName?: string | null;
  reference: string;
}) {
  if (v.label?.trim()) {
    return v.label.trim();
  }
  const parts = [v.color, v.size, v.modelName].map((p) => p?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : v.reference;
}

export function serializeVariantRow(v: {
  id: string;
  itemId: string;
  reference: string;
  label: string | null;
  size: string | null;
  color: string | null;
  modelName: string | null;
  unitValue: number;
  rentalPrice: number | null;
  salePrice: number | null;
  totalQuantity: number;
  availableQty: number;
  allocatedQty: number;
  repairQty: number;
  minThreshold: number;
  maxStockQty: number;
  safetyStockQty: number;
  optimalStockQty: number;
  alertThresholdQty: number;
  criticalThresholdQty: number;
  condition: ItemCondition;
  status: ItemStatus;
  barcode: string | null;
  photoUrl: string | null;
  sortOrder: number;
}) {
  return {
    ...v,
    label: variantDisplayLabel(v),
    conditionLabel: conditionToUi(v.condition),
    stockLevels: stockLevelsFromDb(v),
    stockStatus: computeStockLevelStatus(v.availableQty, stockLevelsFromDb(v)),
    isCritical: isStockAlertStatus(
      computeStockLevelStatus(v.availableQty, stockLevelsFromDb(v)),
    ),
  };
}

export function normalizeVariantPayload(raw: VariantWriteInput) {
  const condition = raw.condition ?? ItemCondition.GOOD;
  return {
    reference: raw.reference.trim(),
    label: raw.label?.trim() || null,
    size: raw.size?.trim() || null,
    color: raw.color?.trim() || null,
    modelName: raw.modelName?.trim() || null,
    unitValue: raw.unitValue,
    rentalPrice: raw.rentalPrice ?? null,
    salePrice: raw.salePrice ?? null,
    totalQuantity: raw.totalQuantity,
    ...stockLevelsToDb(
      stockLevelsSchema.parse(
        stockLevelsFromDb({
          minThreshold: raw.minThreshold ?? 0,
          maxStockQty: raw.maxStockQty ?? 0,
          safetyStockQty: raw.safetyStockQty ?? 0,
          optimalStockQty: raw.optimalStockQty ?? 0,
          alertThresholdQty: raw.alertThresholdQty ?? 0,
          criticalThresholdQty: raw.criticalThresholdQty ?? 0,
        }),
      ),
    ),
    condition,
    status: syncStatusFromCondition(condition),
    barcode: raw.barcode?.trim() || null,
    photoUrl: raw.photoUrl?.trim() || null,
    sortOrder: raw.sortOrder ?? 0,
  };
}

/** Valeur select : `itemId` ou `itemId:variantId`. */
export function parseStockTarget(value: string): { itemId: string; itemVariantId?: string } {
  const trimmed = value.trim();
  const colon = trimmed.indexOf(":");
  if (colon > 0) {
    const itemId = trimmed.slice(0, colon);
    const itemVariantId = trimmed.slice(colon + 1);
    if (isValidMongoObjectId(itemId) && isValidMongoObjectId(itemVariantId)) {
      return { itemId, itemVariantId };
    }
  }
  return { itemId: trimmed };
}

export function stockTargetValue(itemId: string, itemVariantId?: string | null) {
  return itemVariantId ? `${itemId}:${itemVariantId}` : itemId;
}

type StockQuantities = {
  totalQuantity: number;
  availableQty: number;
  allocatedQty: number;
  repairQty: number;
  minThreshold: number;
};

export async function loadStockQuantities(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  organizationId: string,
  itemId: string,
  itemVariantId?: string,
): Promise<StockQuantities | null> {
  if (itemVariantId) {
    const row = await db.itemVariant.findFirst({
      where: { id: itemVariantId, itemId, organizationId },
      select: {
        totalQuantity: true,
        availableQty: true,
        allocatedQty: true,
        repairQty: true,
        minThreshold: true,
      },
    });
    return row;
  }
  const row = await db.item.findFirst({
    where: { id: itemId, organizationId },
    select: {
      totalQuantity: true,
      availableQty: true,
      allocatedQty: true,
      repairQty: true,
      minThreshold: true,
    },
  });
  return row;
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  organizationId: string,
  itemId: string,
  itemVariantId: string | undefined,
  delta: { available?: number; allocated?: number; repair?: number; total?: number },
) {
  const data: Prisma.ItemVariantUpdateInput = {};
  if (delta.available !== undefined) {
    data.availableQty = { increment: delta.available };
  }
  if (delta.allocated !== undefined) {
    data.allocatedQty = { increment: delta.allocated };
  }
  if (delta.repair !== undefined) {
    data.repairQty = { increment: delta.repair };
  }
  if (delta.total !== undefined) {
    data.totalQuantity = { increment: delta.total };
  }

  if (itemVariantId) {
    await tx.itemVariant.update({ where: { id: itemVariantId }, data });
    await syncItemAggregatesFromVariants(tx, itemId);
    return;
  }
  await tx.item.update({ where: { id: itemId }, data: data as Prisma.ItemUpdateInput });
}

export async function syncItemAggregatesFromVariants(tx: Prisma.TransactionClient, itemId: string) {
  const variants = await tx.itemVariant.findMany({
    where: { itemId },
    select: {
      totalQuantity: true,
      availableQty: true,
      allocatedQty: true,
      repairQty: true,
      minThreshold: true,
      maxStockQty: true,
      safetyStockQty: true,
      optimalStockQty: true,
      alertThresholdQty: true,
      criticalThresholdQty: true,
      unitValue: true,
    },
  });
  if (variants.length === 0) {
    return;
  }
  const sum = variants.reduce(
    (acc, v) => ({
      totalQuantity: acc.totalQuantity + v.totalQuantity,
      availableQty: acc.availableQty + v.availableQty,
      allocatedQty: acc.allocatedQty + v.allocatedQty,
      repairQty: acc.repairQty + v.repairQty,
      minThreshold: acc.minThreshold + v.minThreshold,
      maxStockQty: acc.maxStockQty + v.maxStockQty,
      safetyStockQty: acc.safetyStockQty + v.safetyStockQty,
      optimalStockQty: acc.optimalStockQty + v.optimalStockQty,
      alertThresholdQty: acc.alertThresholdQty + v.alertThresholdQty,
      criticalThresholdQty: acc.criticalThresholdQty + v.criticalThresholdQty,
    }),
    {
      totalQuantity: 0,
      availableQty: 0,
      allocatedQty: 0,
      repairQty: 0,
      minThreshold: 0,
      maxStockQty: 0,
      safetyStockQty: 0,
      optimalStockQty: 0,
      alertThresholdQty: 0,
      criticalThresholdQty: 0,
    },
  );
  const avgUnitValue =
    variants.reduce((s, v) => s + v.unitValue * v.totalQuantity, 0) /
    Math.max(1, sum.totalQuantity);

  await tx.item.update({
    where: { id: itemId },
    data: {
      hasVariants: true,
      totalQuantity: sum.totalQuantity,
      availableQty: sum.availableQty,
      allocatedQty: sum.allocatedQty,
      repairQty: sum.repairQty,
      minThreshold: sum.minThreshold,
      maxStockQty: sum.maxStockQty,
      safetyStockQty: sum.safetyStockQty,
      optimalStockQty: sum.optimalStockQty,
      alertThresholdQty: sum.alertThresholdQty,
      criticalThresholdQty: sum.criticalThresholdQty,
      unitValue: Number.isFinite(avgUnitValue) ? avgUnitValue : 0,
    },
  });
}

export async function upsertItemVariants(
  tx: Prisma.TransactionClient,
  organizationId: string,
  itemId: string,
  variants: VariantWriteInput[],
) {
  const existing = await tx.itemVariant.findMany({
    where: { itemId, organizationId },
    select: { id: true, reference: true, _count: { select: { eventItems: true, movements: true } } },
  });
  const keepIds = new Set<string>();

  for (let i = 0; i < variants.length; i += 1) {
    const raw = variants[i];
    const data = normalizeVariantPayload(raw);
    const qty = raw.totalQuantity;
    if (raw.id && isValidMongoObjectId(raw.id)) {
      keepIds.add(raw.id);
      await tx.itemVariant.update({
        where: { id: raw.id },
        data: {
          ...data,
          sortOrder: raw.sortOrder ?? i,
          totalQuantity: qty,
        },
      });
      const prev = await tx.itemVariant.findUnique({
        where: { id: raw.id },
        select: { totalQuantity: true, allocatedQty: true, repairQty: true },
      });
      if (prev && qty < prev.allocatedQty + prev.repairQty) {
        throw new Error("Quantité variante insuffisante par rapport aux affectations.");
      }
      const computedAvailable = qty - (prev?.allocatedQty ?? 0) - (prev?.repairQty ?? 0);
      await tx.itemVariant.update({
        where: { id: raw.id },
        data: { availableQty: computedAvailable },
      });
    } else {
      const created = await tx.itemVariant.create({
        data: {
          ...data,
          itemId,
          organizationId,
          totalQuantity: qty,
          availableQty: qty,
          allocatedQty: 0,
          repairQty: 0,
          sortOrder: raw.sortOrder ?? i,
        },
      });
      keepIds.add(created.id);
    }
  }

  for (const row of existing) {
    if (keepIds.has(row.id)) {
      continue;
    }
    if (row._count.eventItems > 0 || row._count.movements > 0) {
      throw new Error(`Impossible de supprimer la variante ${row.reference} : mouvements ou affectations existants.`);
    }
    await tx.itemVariant.delete({ where: { id: row.id } });
  }

  await syncItemAggregatesFromVariants(tx, itemId);
}
