import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";

export const handheldCreateSchema = z.object({
  code: z.string().min(3).max(48),
  label: z.string().min(2).max(120),
  serialNumber: z.string().max(80).optional().nullable(),
  batteryAutonomyHours: z.number().int().min(8).max(72).optional(),
  warehouseId: z
    .string()
    .refine(isValidMongoObjectId, { message: "Entrepôt invalide" })
    .optional()
    .nullable(),
  assignedUserId: z
    .string()
    .refine(isValidMongoObjectId, { message: "Utilisateur invalide" })
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

export const handheldUpdateSchema = handheldCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification" });

export type HandheldCreateInput = z.infer<typeof handheldCreateSchema>;
export type HandheldUpdateInput = z.infer<typeof handheldUpdateSchema>;

export function normalizeHandheldCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}
