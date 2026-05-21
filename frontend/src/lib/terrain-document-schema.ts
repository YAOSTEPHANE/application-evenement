import { BsSubtype, BtSubtype, StockDocumentKind } from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const tagCodesSchema = z.array(z.string().min(3).max(40)).min(1).max(200);

const terrainBsSchema = z.object({
  kind: z.literal(StockDocumentKind.BS).default(StockDocumentKind.BS),
  eventId: objectId,
  tagCodes: tagCodesSchema,
  bsSubtype: z.literal(BsSubtype.BS_EVT).default(BsSubtype.BS_EVT),
  clientTempId: z.string().max(80).optional(),
});

const terrainBtSchema = z.object({
  kind: z.literal(StockDocumentKind.BT),
  fromWarehouseId: objectId,
  toWarehouseId: objectId,
  tagCodes: tagCodesSchema,
  btSubtype: z.nativeEnum(BtSubtype).default(BtSubtype.BT_SE),
  clientTempId: z.string().max(80).optional(),
});

export const terrainCreateDocumentSchema = z.discriminatedUnion("kind", [
  terrainBsSchema,
  terrainBtSchema,
]);

export type TerrainCreateDocumentInput = z.infer<typeof terrainCreateDocumentSchema>;
