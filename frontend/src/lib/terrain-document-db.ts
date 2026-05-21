import { StockDocumentKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";
import {
  terrainCreateDocumentSchema,
  type TerrainCreateDocumentInput,
} from "@/lib/terrain-document-schema";
import type { Role } from "@prisma/client";

export { terrainCreateDocumentSchema, type TerrainCreateDocumentInput };

async function resolveTagLines(organizationId: string, tagCodes: string[]) {
  const normalized = [...new Set(tagCodes.map((t) => t.trim().toUpperCase()))];
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

  return assets.map((a) => ({
    trackedAssetId: a.id,
    itemId: a.itemId,
    expectedQty: 1,
  }));
}

export async function createTerrainDocumentFromTags(
  organizationId: string,
  raw: unknown,
  actorRole?: Role,
) {
  const payload = terrainCreateDocumentSchema.parse(raw);
  const lines = await resolveTagLines(organizationId, payload.tagCodes);

  if (payload.kind === StockDocumentKind.BS) {
    const event = await prisma.event.findFirst({
      where: { id: payload.eventId, organizationId },
      select: { id: true },
    });
    if (!event) {
      throw new StockDocumentDbError("Commande introuvable", 404);
    }
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

  if (payload.fromWarehouseId === payload.toWarehouseId) {
    throw new StockDocumentDbError("Les entrepôts source et destination doivent être distincts", 400);
  }

  const [fromWh, toWh] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: payload.fromWarehouseId, organizationId },
      select: { id: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: payload.toWarehouseId, organizationId },
      select: { id: true },
    }),
  ]);
  if (!fromWh || !toWh) {
    throw new StockDocumentDbError("Entrepôt source ou destination introuvable", 404);
  }

  return createStockDocument(
    organizationId,
    {
      kind: StockDocumentKind.BT,
      btSubtype: payload.btSubtype,
      fromWarehouseId: payload.fromWarehouseId,
      toWarehouseId: payload.toWarehouseId,
      lines,
    },
    actorRole,
  );
}
