import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDayKeys(n: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(utcDayKey(d));
  }
  return keys;
}

export async function GET() {
  const { organizationId } = await getRequestContext();

  const since14 = new Date();
  since14.setUTCDate(since14.getUTCDate() - 14);
  since14.setUTCHours(0, 0, 0, 0);

  const [
    items,
    activeEvents,
    criticalItems,
    movementCount,
    totalStockValue,
    movementTypeGroups,
    recentMovements,
  ] = await Promise.all([
    prisma.item.count({ where: { organizationId } }),
    prisma.event.count({
      where: {
        organizationId,
        endsAt: { gte: new Date() },
      },
    }),
    prisma.item.findMany({
      where: { organizationId },
      select: { id: true, name: true, availableQty: true, minThreshold: true, reference: true },
      orderBy: { availableQty: "asc" },
      take: 10,
    }),
    prisma.stockMovement.count({ where: { organizationId } }),
    prisma.item.aggregate({
      where: { organizationId },
      _sum: { unitValue: true, totalQuantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["movementType"],
      where: { organizationId },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: { organizationId, createdAt: { gte: since14 } },
      select: { createdAt: true, movementType: true, quantity: true },
    }),
  ]);

  const alerts = criticalItems.filter((item) => item.availableQty <= item.minThreshold);

  const movementByType: Record<string, number> = {
    OUTBOUND: 0,
    RETURN: 0,
    ADJUSTMENT: 0,
  };
  for (const row of movementTypeGroups) {
    movementByType[row.movementType] = row._sum.quantity ?? 0;
  }

  const dayKeys = lastNDayKeys(14);
  const seriesMap = new Map(
    dayKeys.map((day) => [day, { outbound: 0, returns: 0, other: 0 }]),
  );
  for (const m of recentMovements) {
    const key = utcDayKey(m.createdAt);
    const bucket = seriesMap.get(key);
    if (!bucket) {
      continue;
    }
    if (m.movementType === "OUTBOUND") {
      bucket.outbound += m.quantity;
    } else if (m.movementType === "RETURN") {
      bucket.returns += m.quantity;
    } else {
      bucket.other += m.quantity;
    }
  }
  const movementsSeries14d = dayKeys.map((day) => {
    const b = seriesMap.get(day)!;
    const total = b.outbound + b.returns + b.other;
    return { day, outbound: b.outbound, returns: b.returns, other: b.other, total };
  });

  const allocatedSum = await prisma.item.aggregate({
    where: { organizationId },
    _sum: { allocatedQty: true, totalQuantity: true },
  });
  const totQty = allocatedSum._sum.totalQuantity ?? 0;
  const allocQty = allocatedSum._sum.allocatedQty ?? 0;
  const allocationRatePct = totQty > 0 ? Math.round((allocQty / totQty) * 1000) / 10 : 0;

  return NextResponse.json({
    metrics: {
      items,
      activeEvents,
      alerts: alerts.length,
      movements: movementCount,
      stockValueEstimate:
        (totalStockValue._sum.unitValue ?? 0) * (totalStockValue._sum.totalQuantity ?? 0),
      allocationRatePct,
    },
    alerts,
    movementByType,
    movementsSeries14d,
  });
}

