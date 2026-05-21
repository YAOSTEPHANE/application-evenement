import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import type { PortalScanOptions } from "@/lib/stock-document-db";

export const portalScanBodySchema = z.object({
  tagCodes: z.array(z.string().min(3)).min(1),
  warehouseId: z
    .string()
    .refine(isValidMongoObjectId, { message: "ObjectId invalide" })
    .optional(),
  portalId: z
    .string()
    .refine(isValidMongoObjectId, { message: "ObjectId invalide" })
    .optional(),
  portalCode: z.string().min(3).max(48).optional(),
});

export function portalScanOptionsFromBody(body: z.infer<typeof portalScanBodySchema>): PortalScanOptions {
  return {
    warehouseId: body.warehouseId,
    portalId: body.portalId,
    portalCode: body.portalCode,
  };
}

export function parseTagCodesInput(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}
