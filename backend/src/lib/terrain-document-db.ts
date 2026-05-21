import { BsSubtype, StockDocumentKind } from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { createStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";
import type { Role } from "@prisma/client";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

export const terrainCreateDocumentSchema = z.object({
  eventId: objectId,
  tagCodes: z.array(z.string().min(3).max(40)).min(1).max(200),
  kind: z.literal(StockDocumentKind.BS).default(StockDocumentKind.BS),
  bsSubtype: z.literal(BsSubtype.BS_EVT).default(BsSubtype.BS_EVT),
  clientTempId: z.string().max(80).optional(),
});

export type TerrainCreateDocumentInput = z.infer<typeof terrainCreateDocumentSchema>;

export async function createTerrainDocumentFromTags(
  organizationId: string,
  raw: unknown,
  actorRole?: Role,
) {
  const payload = terrainCreateDocumentSchema.parse(raw);
  const normalized = [...new Set(payload.tagCodes.map((t) => t.trim().toUpperCase()))];

  const assets = await prisma.trackedAsset.findMany({
    where: { organizationId, tagCode: { in: normalized } },
    select: { id: true, tagCode: true, itemId: true },
  });

  if (assets.length !== normalized.length) {
    const found = new Set(assets.map((a) => a.tagCode));
    const missing = normalized.filter((t) => !found.has(t));
    throw new StockDocumentDbError(
      `Tags introuvables : ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      404,
    );
  }

  const event = await prisma.event.findFirst({
    where: { id: payload.eventId, organizationId },
    select: { id: true },
  });
  if (!event) {
    throw new StockDocumentDbError("Commande introuvable", 404);
  }

  const lines = assets.map((a) => ({
    trackedAssetId: a.id,
    itemId: a.itemId,
    expectedQty: 1,
  }));

  return createStockDocument(
    organizationId,
    {
      kind: payload.kind,
      bsSubtype: payload.bsSubtype,
      eventId: payload.eventId,
      lines,
    },
    actorRole,
  );
}
