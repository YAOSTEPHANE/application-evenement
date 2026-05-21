import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    const now = new Date();

    const [pending, inProgress, settled, upcoming, withMaterial] = await Promise.all([
      prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.PENDING } }),
      prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.IN_PROGRESS } }),
      prisma.event.count({ where: { organizationId, orderStatus: OrderStatus.SETTLED } }),
      prisma.event.count({
        where: {
          organizationId,
          orderStatus: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
          startsAt: { gte: now },
        },
      }),
      prisma.event.count({
        where: {
          organizationId,
          eventItems: { some: {} },
          orderStatus: { not: OrderStatus.SETTLED },
        },
      }),
    ]);

    return NextResponse.json({
      pending,
      inProgress,
      settled,
      total: pending + inProgress + settled,
      upcoming,
      withMaterial,
    });
  } catch {
    return NextResponse.json({ message: "Statistiques commandes indisponibles" }, { status: 500 });
  }
}
