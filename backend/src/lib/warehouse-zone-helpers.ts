import { StorageZoneAccess, StorageZoneType } from "@prisma/client";
import { z } from "zod";

export const ZONE_CODE_REGEX = /^[A-Z0-9]{2,16}(-[A-Z0-9]{2,12}){0,3}$/;

export type StorageZoneTypeUi = "Réception" | "Picking" | "Rayonnage" | "Retour";
export type StorageZoneAccessUi = "Libre" | "Restreint";

const ZONE_TYPE_VALUES = [
  StorageZoneType.RECEPTION,
  StorageZoneType.PICKING,
  StorageZoneType.SHELVING,
  StorageZoneType.RETURN,
] as const;

const ZONE_ACCESS_VALUES = [StorageZoneAccess.FREE, StorageZoneAccess.RESTRICTED] as const;

export function zoneTypeToUi(type: StorageZoneType): StorageZoneTypeUi {
  switch (type) {
    case StorageZoneType.PICKING:
      return "Picking";
    case StorageZoneType.SHELVING:
      return "Rayonnage";
    case StorageZoneType.RETURN:
      return "Retour";
    default:
      return "Réception";
  }
}

export function zoneTypeFromUi(type: StorageZoneTypeUi): StorageZoneType {
  switch (type) {
    case "Picking":
      return StorageZoneType.PICKING;
    case "Rayonnage":
      return StorageZoneType.SHELVING;
    case "Retour":
      return StorageZoneType.RETURN;
    default:
      return StorageZoneType.RECEPTION;
  }
}

export function zoneAccessToUi(access: StorageZoneAccess): StorageZoneAccessUi {
  return access === StorageZoneAccess.RESTRICTED ? "Restreint" : "Libre";
}

export function zoneAccessFromUi(access: StorageZoneAccessUi): StorageZoneAccess {
  return access === "Restreint" ? StorageZoneAccess.RESTRICTED : StorageZoneAccess.FREE;
}

export function zoneTypeBadgeClass(type: StorageZoneType): string {
  switch (type) {
    case StorageZoneType.RECEPTION:
      return "badge-info";
    case StorageZoneType.PICKING:
      return "badge-gold";
    case StorageZoneType.SHELVING:
      return "badge-navy";
    case StorageZoneType.RETURN:
      return "badge-warn";
    default:
      return "badge-navy";
  }
}

const zoneBaseSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().regex(ZONE_CODE_REGEX, "Code invalide (ex. Z-RCP ou Z-RCP-A01)"),
  zoneType: z.enum(ZONE_TYPE_VALUES),
  locationLabel: z.string().max(300).optional().nullable(),
  totalCapacity: z.number().int().nonnegative().optional().nullable(),
  capacityUnit: z.string().max(40).optional().nullable(),
  accessType: z.enum(ZONE_ACCESS_VALUES).optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const storageZoneCreateSchema = zoneBaseSchema;
export const storageZoneUpdateSchema = zoneBaseSchema.partial();

export type StorageZoneCreateInput = z.infer<typeof storageZoneCreateSchema>;
export type StorageZoneUpdateInput = z.infer<typeof storageZoneUpdateSchema>;

export function proposeZoneCode(zoneType: StorageZoneType, warehouseCode: string): string {
  const suffix =
    zoneType === StorageZoneType.RECEPTION
      ? "RCP"
      : zoneType === StorageZoneType.PICKING
        ? "PCK"
        : zoneType === StorageZoneType.RETURN
          ? "RET"
          : "SHF";
  return `${warehouseCode}-Z-${suffix}`;
}

export function normalizeStorageZonePayload(raw: StorageZoneCreateInput | StorageZoneUpdateInput) {
  return {
    name: raw.name?.trim() ?? "",
    code: raw.code?.trim().toUpperCase() ?? "",
    zoneType: raw.zoneType ?? StorageZoneType.RECEPTION,
    locationLabel: raw.locationLabel?.trim() || null,
    totalCapacity: raw.totalCapacity ?? null,
    capacityUnit: raw.capacityUnit?.trim() || null,
    accessType: raw.accessType ?? StorageZoneAccess.FREE,
    notes: raw.notes?.trim() || null,
    active: raw.active ?? true,
    sortOrder: raw.sortOrder ?? 0,
  };
}
