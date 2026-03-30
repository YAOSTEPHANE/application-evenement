import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  const { organizationId } = await getRequestContext();

  const [items, activeEvents, criticalItems, movementCount, totalStockValue] = await Promise.all([
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
  ]);

  const alerts = criticalItems.filter((item) => item.availableQty <= item.minThreshold);

  return NextResponse.json({
    metrics: {
      items,
      activeEvents,
      alerts: alerts.length,
      movements: movementCount,
      stockValueEstimate:
        (totalStockValue._sum.unitValue ?? 0) * (totalStockValue._sum.totalQuantity ?? 0),
    },
    alerts,
  });
}

