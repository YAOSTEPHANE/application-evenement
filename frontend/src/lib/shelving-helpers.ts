import { ShelvingLevel, ShelvingMaterial } from "@prisma/client";
import { z } from "zod";

export const SHELF_SEGMENT_REGEX = /^[A-Z0-9]{1,8}$/;
export const COORDINATE_REGEX = /^[A-Z0-9]{1,8}(-[A-Z0-9]{1,8}){0,3}$/;

export type ShelvingLevelUi = "Allée" | "Rack" | "Étagère" | "Emplacement";
export type ShelvingMaterialUi = "Métal" | "Bois" | "Plastique";

const LEVEL_VALUES = [
  ShelvingLevel.AISLE,
  ShelvingLevel.RACK,
  ShelvingLevel.SHELF,
  ShelvingLevel.BIN,
] as const;

const MATERIAL_VALUES = [
  ShelvingMaterial.METAL,
  ShelvingMaterial.WOOD,
  ShelvingMaterial.PLASTIC,
] as const;

export function shelvingLevelToUi(level: ShelvingLevel): ShelvingLevelUi {
  switch (level) {
    case ShelvingLevel.RACK:
      return "Rack";
    case ShelvingLevel.SHELF:
      return "Étagère";
    case ShelvingLevel.BIN:
      return "Emplacement";
    default:
      return "Allée";
  }
}

export function shelvingLevelFromUi(level: ShelvingLevelUi): ShelvingLevel {
  switch (level) {
    case "Rack":
      return ShelvingLevel.RACK;
    case "Étagère":
      return ShelvingLevel.SHELF;
    case "Emplacement":
      return ShelvingLevel.BIN;
    default:
      return ShelvingLevel.AISLE;
  }
}

export function shelvingMaterialToUi(m: ShelvingMaterial): ShelvingMaterialUi {
  switch (m) {
    case ShelvingMaterial.WOOD:
      return "Bois";
    case ShelvingMaterial.PLASTIC:
      return "Plastique";
    default:
      return "Métal";
  }
}

export function shelvingMaterialFromUi(m: ShelvingMaterialUi): ShelvingMaterial {
  switch (m) {
    case "Bois":
      return ShelvingMaterial.WOOD;
    case "Plastique":
      return ShelvingMaterial.PLASTIC;
    default:
      return ShelvingMaterial.METAL;
  }
}

export function shelvingLevelBadgeClass(level: ShelvingLevel): string {
  switch (level) {
    case ShelvingLevel.AISLE:
      return "badge-navy";
    case ShelvingLevel.RACK:
      return "badge-gold";
    case ShelvingLevel.SHELF:
      return "badge-info";
    case ShelvingLevel.BIN:
      return "badge-ok";
    default:
      return "badge-gray";
  }
}

export function childLevelFor(parent: ShelvingLevel | null): ShelvingLevel {
  if (!parent) {
    return ShelvingLevel.AISLE;
  }
  switch (parent) {
    case ShelvingLevel.AISLE:
      return ShelvingLevel.RACK;
    case ShelvingLevel.RACK:
      return ShelvingLevel.SHELF;
    case ShelvingLevel.SHELF:
      return ShelvingLevel.BIN;
    default:
      return ShelvingLevel.BIN;
  }
}

export function buildCoordinate(parentCoordinate: string | null, code: string): string {
  const segment = code.trim().toUpperCase();
  if (!parentCoordinate) {
    return segment;
  }
  return `${parentCoordinate}-${segment}`;
}

export function formatDimensions(
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
  depthCm: number | null | undefined,
): string | null {
  if (widthCm == null && heightCm == null && depthCm == null) {
    return null;
  }
  const w = widthCm != null ? `${widthCm}` : "—";
  const h = heightCm != null ? `${heightCm}` : "—";
  const d = depthCm != null ? `${depthCm}` : "—";
  return `${w} × ${h} × ${d} cm`;
}

const shelvingBaseSchema = z.object({
  parentId: z.string().optional().nullable(),
  level: z.enum(LEVEL_VALUES),
  code: z.string().regex(SHELF_SEGMENT_REGEX, "Segment invalide (ex. A, 1, 2)"),
  label: z.string().max(120).optional().nullable(),
  materialType: z.enum(MATERIAL_VALUES).optional().nullable(),
  weightCapacityKg: z.number().positive().optional().nullable(),
  widthCm: z.number().positive().optional().nullable(),
  heightCm: z.number().positive().optional().nullable(),
  depthCm: z.number().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const shelvingCreateSchema = shelvingBaseSchema;
export const shelvingUpdateSchema = shelvingBaseSchema.partial();

export type ShelvingCreateInput = z.infer<typeof shelvingCreateSchema>;
export type ShelvingUpdateInput = z.infer<typeof shelvingUpdateSchema>;

export function normalizeShelvingPayload(raw: ShelvingCreateInput | ShelvingUpdateInput) {
  return {
    parentId: raw.parentId ?? null,
    level: raw.level ?? ShelvingLevel.AISLE,
    code: raw.code?.trim().toUpperCase() ?? "",
    label: raw.label?.trim() || null,
    materialType: raw.materialType ?? null,
    weightCapacityKg: raw.weightCapacityKg ?? null,
    widthCm: raw.widthCm ?? null,
    heightCm: raw.heightCm ?? null,
    depthCm: raw.depthCm ?? null,
    notes: raw.notes?.trim() || null,
    active: raw.active ?? true,
    sortOrder: raw.sortOrder ?? 0,
  };
}
