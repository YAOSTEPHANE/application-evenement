import { PortalInstallationSite, PortalPassageDirection } from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";

export const portalCreateSchema = z.object({
  code: z.string().min(3).max(48),
  label: z.string().min(2).max(120),
  locationHint: z.string().max(240).optional().nullable(),
  installationSite: z
    .nativeEnum(PortalInstallationSite)
    .default(PortalInstallationSite.WAREHOUSE_GATE),
  passageDirection: z.nativeEnum(PortalPassageDirection).default(PortalPassageDirection.EXIT),
  warehouseId: z.string().refine(isValidMongoObjectId, { message: "Entrepôt invalide" }),
  active: z.boolean().optional(),
});

export const portalUpdateSchema = portalCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification" });

export type PortalCreateInput = z.infer<typeof portalCreateSchema>;
export type PortalUpdateInput = z.infer<typeof portalUpdateSchema>;

export function normalizePortalCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}
