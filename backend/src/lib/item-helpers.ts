import { ItemCondition, ItemStatus, RfidTagType } from "@prisma/client";
import { z } from "zod";

import { itemAttributesSchema, normalizeItemAttributes } from "@/lib/item-attribute-helpers";
import {
  type ArticleConditionUi,
  conditionFromUi,
  formatGalleryLines,
  ITEM_CONDITION,
  parseGalleryLines,
} from "@/lib/item-shared";
import {
  computeStockLevelStatus,
  isStockAlertStatus,
  stockLevelsFromDb,
  stockLevelsSchema,
  stockLevelsToDb,
} from "@/lib/stock-level-helpers";

export type { ArticleConditionUi };
export { conditionFromUi, formatGalleryLines, parseGalleryLines };

const optionalUrl = z.union([z.string().url().max(2048), z.literal("")]).optional().nullable();
const optionalStr = z.string().max(500).optional().nullable();
const optionalNum = z.number().nonnegative().optional().nullable();

function refineStockLevels(
  data: {
    minThreshold: number;
    maxStockQty: number;
    safetyStockQty: number;
    optimalStockQty: number;
    alertThresholdQty: number;
    criticalThresholdQty: number;
  },
  ctx: z.RefinementCtx,
) {
  const parsed = stockLevelsSchema.safeParse(stockLevelsFromDb(data));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const pathKey =
        issue.path[0] === "min"
          ? "minThreshold"
          : issue.path[0] === "max"
            ? "maxStockQty"
            : issue.path[0] === "safety"
              ? "safetyStockQty"
              : issue.path[0] === "optimal"
                ? "optimalStockQty"
                : issue.path[0] === "alert"
                  ? "alertThresholdQty"
                  : issue.path[0] === "critical"
                    ? "criticalThresholdQty"
                    : "minThreshold";
      ctx.addIssue({ ...issue, path: [pathKey] });
    }
  }
}

const itemWriteBaseSchema = z.object({
  name: z.string().min(2).max(200),
  reference: z.string().min(2).max(80),
  categoryId: z.string().min(1),
  description: z.string().max(8000).optional().nullable(),
  photoUrl: optionalUrl,
  galleryUrls: z.array(z.string().url().max(2048)).max(20).optional(),
  emoji: z.string().max(8).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  brand: optionalStr,
  model: optionalStr,
  variant: optionalStr,
  weightKg: optionalNum,
  lengthCm: optionalNum,
  widthCm: optionalNum,
  heightCm: optionalNum,
  barcode: z.string().max(64).optional().nullable(),
  defaultRfidTagType: z.nativeEnum(RfidTagType).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  lotNumber: z.string().max(120).optional().nullable(),
  supplierName: z.string().max(200).optional().nullable(),
  unitValue: z.number().nonnegative(),
  rentalPrice: optionalNum,
  salePrice: optionalNum,
  usefulLifeMonths: z.number().int().nonnegative().optional().nullable(),
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
  customFields: itemAttributesSchema.shape.customFields,
  technicalParams: itemAttributesSchema.shape.technicalParams,
  certifications: itemAttributesSchema.shape.certifications,
  safetyStandards: itemAttributesSchema.shape.safetyStandards,
  specialInstructions: itemAttributesSchema.shape.specialInstructions,
});

export const itemWriteSchema = itemWriteBaseSchema.superRefine(refineStockLevels);

export const itemCreateSchema = itemWriteBaseSchema
  .extend({
    totalQuantity: z.number().int().positive(),
  })
  .superRefine(refineStockLevels);

export const itemUpdateSchema = itemWriteBaseSchema.partial();

export const ITEM_PUBLIC_SELECT = {
  id: true,
  name: true,
  reference: true,
  description: true,
  photoUrl: true,
  galleryUrls: true,
  emoji: true,
  notes: true,
  brand: true,
  model: true,
  variant: true,
  weightKg: true,
  lengthCm: true,
  widthCm: true,
  heightCm: true,
  barcode: true,
  defaultRfidTagType: true,
  serialNumber: true,
  lotNumber: true,
  supplierName: true,
  unitValue: true,
  rentalPrice: true,
  salePrice: true,
  usefulLifeMonths: true,
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
  status: true,
  condition: true,
  hasVariants: true,
  customFields: true,
  technicalParams: true,
  certifications: true,
  safetyStandards: true,
  specialInstructions: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function conditionToUi(value: ItemCondition): ArticleConditionUi {
  switch (value) {
    case ItemCondition.NEW:
      return "Neuf";
    case ItemCondition.NEEDS_REPAIR:
      return "À réparer";
    case ItemCondition.OBSOLETE:
      return "Obsolète";
    default:
      return "Bon";
  }
}

export function syncStatusFromCondition(condition: ItemCondition): ItemStatus {
  switch (condition) {
    case ItemCondition.NEEDS_REPAIR:
      return ItemStatus.IN_REPAIR;
    case ItemCondition.OBSOLETE:
      return ItemStatus.ARCHIVED;
    default:
      return ItemStatus.AVAILABLE;
  }
}

export function normalizeItemPayload(raw: z.infer<typeof itemWriteSchema>) {
  const condition = raw.condition ?? ItemCondition.GOOD;
  const attributes = normalizeItemAttributes({
    customFields: raw.customFields,
    technicalParams: raw.technicalParams,
    certifications: raw.certifications,
    safetyStandards: raw.safetyStandards,
    specialInstructions: raw.specialInstructions,
  });
  return {
    name: raw.name.trim(),
    reference: raw.reference.trim(),
    categoryId: raw.categoryId,
    description: raw.description?.trim() || null,
    photoUrl: raw.photoUrl?.trim() || null,
    galleryUrls: raw.galleryUrls ?? [],
    emoji: raw.emoji?.trim() || "📦",
    notes: raw.notes?.trim() || null,
    brand: raw.brand?.trim() || null,
    model: raw.model?.trim() || null,
    variant: raw.variant?.trim() || null,
    weightKg: raw.weightKg ?? null,
    lengthCm: raw.lengthCm ?? null,
    widthCm: raw.widthCm ?? null,
    heightCm: raw.heightCm ?? null,
    barcode: raw.barcode?.trim() || null,
    defaultRfidTagType: raw.defaultRfidTagType ?? null,
    serialNumber: raw.serialNumber?.trim() || null,
    lotNumber: raw.lotNumber?.trim() || null,
    supplierName: raw.supplierName?.trim() || null,
    unitValue: raw.unitValue,
    rentalPrice: raw.rentalPrice ?? null,
    salePrice: raw.salePrice ?? null,
    usefulLifeMonths: raw.usefulLifeMonths ?? null,
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
    ...attributes,
  };
}

export function serializeItemRow(item: {
  id: string;
  name: string;
  reference: string;
  description: string | null;
  photoUrl: string | null;
  galleryUrls: string[];
  emoji: string | null;
  notes: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  barcode: string | null;
  defaultRfidTagType: RfidTagType | null;
  serialNumber: string | null;
  lotNumber: string | null;
  supplierName: string | null;
  unitValue: number;
  rentalPrice: number | null;
  salePrice: number | null;
  usefulLifeMonths: number | null;
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
  status: ItemStatus;
  condition: ItemCondition;
  hasVariants: boolean;
  customFields?: unknown;
  technicalParams?: string | null;
  certifications?: string[];
  safetyStandards?: string[];
  specialInstructions?: string | null;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  variants?: ReturnType<typeof import("@/lib/item-variant-helpers").serializeVariantRow>[];
}) {
  const customFields =
    item.customFields && typeof item.customFields === "object" && !Array.isArray(item.customFields)
      ? (item.customFields as Record<string, string | number | boolean>)
      : null;
  return {
    ...item,
    customFields,
    certifications: item.certifications ?? [],
    safetyStandards: item.safetyStandards ?? [],
    stockLevels: stockLevelsFromDb(item),
    stockStatus: computeStockLevelStatus(item.availableQty, stockLevelsFromDb(item)),
    isCritical: isStockAlertStatus(
      computeStockLevelStatus(item.availableQty, stockLevelsFromDb(item)),
    ),
    conditionLabel: conditionToUi(item.condition),
    variants: item.variants ?? [],
  };
}
