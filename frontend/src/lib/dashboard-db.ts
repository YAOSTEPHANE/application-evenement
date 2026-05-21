import { NotificationSeverity, OrderStatus } from "@prisma/client";

import { buildCdcKpis, type CdcKpis } from "@/lib/cdc-kpis-db";
import { ORDER_STATUS_LABELS } from "@/lib/cdc-labels";
import { prisma } from "@/lib/prisma";

export type DashboardOverview = {
  kpis: CdcKpis;
  notifications: { urgent: number; warning: number; unread: number };
  upcomingOrders: Array<{
    id: string;
    name: string;
    clientName: string;
    location: string;
    startsAt: string;
    orderStatus: OrderStatus;
    orderStatusLabel: string;
  }>;
};

export async function getDashboardOverview(organizationId: string): Promise<DashboardOverview> {
  const [kpis, urgent, warning, unread, upcomingOrders] = await Promise.all([
    buildCdcKpis(organizationId),
    prisma.notification.count({
      where: { organizationId, readAt: null, severity: NotificationSeverity.URGENT },
    }),
    prisma.notification.count({
      where: { organizationId, readAt: null, severity: NotificationSeverity.WARNING },
    }),
    prisma.notification.count({
      where: { organizationId, readAt: null },
    }),
    prisma.event.findMany({
      where: {
        organizationId,
        orderStatus: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        id: true,
        name: true,
        clientName: true,
        location: true,
        startsAt: true,
        orderStatus: true,
      },
    }),
  ]);

  return {
    kpis,
    notifications: { urgent, warning, unread },
    upcomingOrders: upcomingOrders.map((e) => ({
      id: e.id,
      name: e.name,
      clientName: e.clientName,
      location: e.location,
      startsAt: e.startsAt.toISOString(),
      orderStatus: e.orderStatus,
      orderStatusLabel: ORDER_STATUS_LABELS[e.orderStatus],
    })),
  };
}
