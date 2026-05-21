import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

/** Schéma Zod exposé pour PATCH /api/settings et tests. */
export const organizationSettingsSchema = z.object({
  defaultWarehouseId: objectId.nullable().optional(),
  /** Cible d'écart inventaire RFID (CDC : < 2 %). */
  inventoryVarianceTargetPct: z.number().min(0).max(100).optional(),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  defaultWarehouseId: null,
  inventoryVarianceTargetPct: 2,
};

export function parseOrganizationSettings(raw: unknown): OrganizationSettings {
  if (raw == null || typeof raw !== "object") {
    return { ...DEFAULT_ORGANIZATION_SETTINGS };
  }
  const parsed = organizationSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ...DEFAULT_ORGANIZATION_SETTINGS };
  }
  return {
    ...DEFAULT_ORGANIZATION_SETTINGS,
    ...parsed.data,
  };
}

export function mergeOrganizationSettings(
  current: OrganizationSettings,
  patch: Partial<OrganizationSettings>,
): OrganizationSettings {
  return {
    ...current,
    ...patch,
    defaultWarehouseId:
      patch.defaultWarehouseId !== undefined
        ? patch.defaultWarehouseId
        : current.defaultWarehouseId ?? null,
  };
}
