import type { LocationStockBalance, Prisma } from "@prisma/client";
import { StorageLocationFillState } from "@prisma/client";

import {
  emptyTotals,
  locationStockUpsertSchema,
  sumTotals,
  totalsFromFields,
  type LocationStockUpsertInput,
  type StockQtyTotals,
} from "@/lib/location-stock-helpers";
import { prisma } from "@/lib/prisma";

export class LocationStockDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LocationStockDbError";
  }
}

function serializeBalance(
  row: LocationStockBalance & {
    item: { id: string; name: string; reference: string; emoji: string | null };
    itemVariant: {
      id: string;
      reference: string;
      label: string | null;
      size: string | null;
      color: string | null;
    } | null;
    warehouse: { id: string; name: string; code: string };
    storageZone: { id: string; name: string; code: string };
    storageLocation: {
      id: string;
      code: string;
      label: string | null;
      hierarchyCoordinate: string | null;
    };
  },
) {
  const totals = totalsFromFields(row);
  const variantLabel = row.itemVariant
    ? [row.itemVariant.label, row.itemVariant.size, row.itemVariant.color]
        .filter(Boolean)
        .join(" · ") || row.itemVariant.reference
    : null;
  return {
    id: row.id,
    itemId: row.itemId,
    itemVariantId: row.itemVariantId,
    itemName: row.item.name,
    itemReference: row.item.reference,
    itemEmoji: row.item.emoji ?? "📦",
    variantLabel,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    warehouseCode: row.warehouse.code,
    storageZoneId: row.storageZoneId,
    zoneName: row.storageZone.name,
    zoneCode: row.storageZone.code,
    storageLocationId: row.storageLocationId,
    locationCode: row.storageLocation.code,
    locationLabel: row.storageLocation.label,
    hierarchyCoordinate: row.storageLocation.hierarchyCoordinate,
    ...totals,
    updatedAt: row.updatedAt,
  };
}

const balanceInclude = {
  item: { select: { id: true, name: true, reference: true, emoji: true } },
  itemVariant: {
    select: { id: true, reference: true, label: true, size: true, color: true },
  },
  warehouse: { select: { id: true, name: true, code: true } },
  storageZone: { select: { id: true, name: true, code: true } },
  storageLocation: {
    select: { id: true, code: true, label: true, hierarchyCoordinate: true },
  },
} satisfies Prisma.LocationStockBalanceInclude;

export async function listLocationStockBalances(
  organizationId: string,
  filters: {
    warehouseId?: string;
    storageZoneId?: string;
    storageLocationId?: string;
    itemId?: string;
  },
) {
  const rows = await prisma.locationStockBalance.findMany({
    where: {
      organizationId,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.storageZoneId ? { storageZoneId: filters.storageZoneId } : {}),
      ...(filters.storageLocationId ? { storageLocationId: filters.storageLocationId } : {}),
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
    },
    include: balanceInclude,
    orderBy: [{ warehouseId: "asc" }, { storageZoneId: "asc" }, { storageLocationId: "asc" }],
  });
  return rows.map(serializeBalance);
}

export async function getLocationStockSummary(organizationId: string, warehouseId?: string) {
  const where: Prisma.LocationStockBalanceWhereInput = {
    organizationId,
    ...(warehouseId ? { warehouseId } : {}),
  };

  const [balances, itemAgg] = await Promise.all([
    prisma.locationStockBalance.findMany({ where }),
    prisma.item.aggregate({
      where: { organizationId },
      _sum: {
        totalQuantity: true,
        availableQty: true,
        allocatedQty: true,
        repairQty: true,
      },
    }),
  ]);

  const lineTotals = balances.map((b) => totalsFromFields(b));
  const located = sumTotals(lineTotals);

  const catalog = {
    totalQuantity: itemAgg._sum.totalQuantity ?? 0,
    availableQty: itemAgg._sum.availableQty ?? 0,
    reservedQty: itemAgg._sum.allocatedQty ?? 0,
    repairQty: itemAgg._sum.repairQty ?? 0,
  };

  const unallocated = {
    availableQty: Math.max(0, catalog.availableQty - located.availableQty),
    reservedQty: Math.max(0, catalog.reservedQty - located.reservedQty),
    systemQty: Math.max(0, catalog.totalQuantity - located.systemQty),
  };

  const byWarehouseMap = new Map<string, StockQtyTotals>();
  const byZoneMeta = new Map<string, { warehouseId: string; totals: StockQtyTotals }>();
  const byLocationMeta = new Map<
    string,
    { warehouseId: string; storageZoneId: string; totals: StockQtyTotals }
  >();

  for (const row of balances) {
    const t = totalsFromFields(row);
    const wh = byWarehouseMap.get(row.warehouseId) ?? emptyTotals();
    byWarehouseMap.set(row.warehouseId, sumTotals([wh, t]));

    const zoneKey = row.storageZoneId;
    const znPrev = byZoneMeta.get(zoneKey);
    byZoneMeta.set(zoneKey, {
      warehouseId: row.warehouseId,
      totals: sumTotals([znPrev?.totals ?? emptyTotals(), t]),
    });

    const locKey = row.storageLocationId;
    const locPrev = byLocationMeta.get(locKey);
    byLocationMeta.set(locKey, {
      warehouseId: row.warehouseId,
      storageZoneId: row.storageZoneId,
      totals: sumTotals([locPrev?.totals ?? emptyTotals(), t]),
    });
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId, ...(warehouseId ? { id: warehouseId } : {}), active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return {
    totals: located,
    catalogTotals: catalog,
    unallocated,
    byWarehouse: warehouses.map((wh) => ({
      id: wh.id,
      name: wh.name,
      code: wh.code,
      totals: byWarehouseMap.get(wh.id) ?? emptyTotals(),
    })),
    byZone: Array.from(byZoneMeta.entries()).map(([id, data]) => ({
      id,
      warehouseId: data.warehouseId,
      totals: data.totals,
    })),
    byLocation: Array.from(byLocationMeta.entries()).map(([id, data]) => ({
      id,
      warehouseId: data.warehouseId,
      storageZoneId: data.storageZoneId,
      totals: data.totals,
    })),
  };
}

async function assertPlacement(
  organizationId: string,
  warehouseId: string,
  storageZoneId: string,
  storageLocationId: string,
) {
  const loc = await prisma.storageLocation.findFirst({
    where: {
      id: storageLocationId,
      organizationId,
      warehouseId,
      storageZoneId,
    },
  });
  if (!loc) {
    throw new LocationStockDbError("Emplacement introuvable pour cette zone / entrepôt", 404);
  }
}

export async function upsertLocationStockBalance(
  organizationId: string,
  raw: unknown,
) {
  const payload: LocationStockUpsertInput = locationStockUpsertSchema.parse(raw);
  await assertPlacement(
    organizationId,
    payload.warehouseId,
    payload.storageZoneId,
    payload.storageLocationId,
  );

  const item = await prisma.item.findFirst({
    where: { id: payload.itemId, organizationId },
  });
  if (!item) {
    throw new LocationStockDbError("Article introuvable", 404);
  }

  if (payload.itemVariantId) {
    const variant = await prisma.itemVariant.findFirst({
      where: { id: payload.itemVariantId, itemId: payload.itemId, organizationId },
    });
    if (!variant) {
      throw new LocationStockDbError("Variante introuvable", 404);
    }
  } else if (item.hasVariants) {
    throw new LocationStockDbError("Précisez une variante pour cet article", 400);
  }

  const physicalQty = payload.physicalQty ?? 0;
  const systemQty = payload.systemQty ?? physicalQty;
  const availableQty = payload.availableQty ?? systemQty;
  const reservedQty = payload.reservedQty ?? 0;
  const inTransitQty = payload.inTransitQty ?? 0;

  const existing = await prisma.locationStockBalance.findFirst({
    where: {
      storageLocationId: payload.storageLocationId,
      itemId: payload.itemId,
      itemVariantId: payload.itemVariantId ?? null,
    },
  });

  const row = existing
    ? await prisma.locationStockBalance.update({
        where: { id: existing.id },
        data: { physicalQty, systemQty, availableQty, reservedQty, inTransitQty },
        include: balanceInclude,
      })
    : await prisma.locationStockBalance.create({
        data: {
          organizationId,
          itemId: payload.itemId,
          itemVariantId: payload.itemVariantId ?? null,
          warehouseId: payload.warehouseId,
          storageZoneId: payload.storageZoneId,
          storageLocationId: payload.storageLocationId,
          physicalQty,
          systemQty,
          availableQty,
          reservedQty,
          inTransitQty,
        },
        include: balanceInclude,
      });

  if (systemQty > 0) {
    const fillRatio = (availableQty + reservedQty) / systemQty;
    const fillState =
      fillRatio <= 0
        ? StorageLocationFillState.EMPTY
        : fillRatio >= 0.95
          ? StorageLocationFillState.FULL
          : StorageLocationFillState.PARTIAL;
    await prisma.storageLocation.update({
      where: { id: payload.storageLocationId },
      data: { fillState },
    });
  }

  return serializeBalance(row);
}

export async function deleteLocationStockBalance(organizationId: string, balanceId: string) {
  const existing = await prisma.locationStockBalance.findFirst({
    where: { id: balanceId, organizationId },
  });
  if (!existing) {
    throw new LocationStockDbError("Ligne de stock introuvable", 404);
  }
  await prisma.locationStockBalance.delete({ where: { id: balanceId } });
}
