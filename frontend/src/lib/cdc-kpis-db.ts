import {
  BtTransitPhase,
  OrderStatus,
  StockDocumentKind,
  StockDocumentStatus,
  TrackedAssetStatus,
} from "@prisma/client";

import { staffOccupancyRate } from "@/lib/hr-db";
import { prisma } from "@/lib/prisma";

export type CdcKpis = {
  orders: { pending: number; inProgress: number; settled: number };
  documents: {
    today: number;
    todayBe: number;
    todayBs: number;
    todayBt: number;
    pendingSignature: number;
    disputed: number;
    transfersOver48h: number;
  };
  sites: {
    activeEventSites: number;
    warehouses: Array<{ id: string; name: string; code: string; kind: string; assetCount: number }>;
  };
  rfid: { taggedAssets: number; catalogQty: number; traceabilityPct: number };
  staff: { pct: number; occupied: number; total: number; teamLeadersTotal?: number };
  inventory: {
    accuracyPct: number;
    gapPct: number;
    quarantineAssets: number;
    mismatchLines: number;
  };
  targets: {
    traceabilityPct: number;
    inventoryAccuracyPct: number;
    inventoryGapPct: number;
  };
};

export async function buildCdcKpis(organizationId: string): Promise<CdcKpis> {
  const since48h = new Date();
  since48h.setHours(since48h.getHours() - 48);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    ordersPending,
    ordersInProgress,
    ordersSettled,
    documentsToday,
    documentsPendingSign,
    documentsDisputed,
    taggedAssets,
    totalAssetsTarget,
    occupancy,
    openTransfers,
    beToday,
    bsToday,
    btToday,
    activeEventSites,
    warehouses,
    quarantineAssets,
  ] = await Promise.all([
    prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.PENDING } }),
    prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.IN_PROGRESS } }),
    prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.SETTLED } }),
    prisma.stockDocument.count({
      where: { organizationId, createdAt: { gte: todayStart } },
    }),
    prisma.stockDocument.count({
      where: {
        organizationId,
        status: { in: [StockDocumentStatus.PENDING_SIGNATURE, StockDocumentStatus.SCANNING] },
      },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.DISPUTED },
    }),
    prisma.trackedAsset.count({ where: { organizationId } }),
    prisma.item.aggregate({
      where: { organizationId },
      _sum: { totalQuantity: true },
    }),
    staffOccupancyRate(organizationId),
    prisma.stockDocument.count({
      where: {
        organizationId,
        kind: StockDocumentKind.BT,
        btTransitPhase: BtTransitPhase.IN_TRANSIT,
        status: StockDocumentStatus.PENDING_SIGNATURE,
        btEmittedAt: { lt: since48h },
      },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BE, createdAt: { gte: todayStart } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BS, createdAt: { gte: todayStart } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BT, createdAt: { gte: todayStart } },
    }),
    prisma.event.count({
      where: { organizationId, orderStatus: OrderStatus.IN_PROGRESS },
    }),
    prisma.warehouse.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        code: true,
        kind: true,
        _count: { select: { trackedAssets: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.trackedAsset.count({
      where: { organizationId, status: TrackedAssetStatus.QUARANTINE },
    }),
  ]);

  const catalogQty = totalAssetsTarget._sum.totalQuantity ?? 0;
  const traceabilityPct =
    catalogQty > 0 ? Math.min(100, Math.round((taggedAssets / catalogQty) * 100)) : 0;

  const gapSignals = quarantineAssets + documentsDisputed;
  const inventoryGapPct =
    catalogQty > 0 ? Math.min(100, Math.round((gapSignals / catalogQty) * 100)) : 0;
  const inventoryAccuracyPct = Math.max(0, 100 - inventoryGapPct);

  return {
    orders: { pending: ordersPending, inProgress: ordersInProgress, settled: ordersSettled },
    documents: {
      today: documentsToday,
      todayBe: beToday,
      todayBs: bsToday,
      todayBt: btToday,
      pendingSignature: documentsPendingSign,
      disputed: documentsDisputed,
      transfersOver48h: openTransfers,
    },
    sites: {
      activeEventSites,
      warehouses: warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        kind: w.kind,
        assetCount: w._count.trackedAssets,
      })),
    },
    rfid: { taggedAssets, catalogQty, traceabilityPct },
    staff: occupancy,
    inventory: {
      accuracyPct: inventoryAccuracyPct,
      gapPct: inventoryGapPct,
      quarantineAssets,
      mismatchLines: documentsDisputed,
    },
    targets: {
      traceabilityPct: 98,
      inventoryAccuracyPct: 98,
      inventoryGapPct: 2,
    },
  };
}
