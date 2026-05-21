import type { NotificationSeverity, Prisma } from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

type CreateNotificationParams = {
  organizationId: string;
  userId: string;
  module: string;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  severity?: NotificationSeverity;
};

export async function createNotification(
  db: Prisma.TransactionClient | typeof prisma,
  params: CreateNotificationParams,
) {
  return db.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      module: params.module,
      title: params.title,
      body: params.body,
      targetType: params.targetType,
      targetId: params.targetId,
      severity: params.severity ?? "INFO",
      channel: "IN_APP",
    },
  });
}

export async function listNotifications(organizationId: string, userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: {
      organizationId,
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markNotificationRead(organizationId: string, userId: string, id: string) {
  const parsed = objectId.parse(id);
  return prisma.notification.updateMany({
    where: { id: parsed, organizationId, userId },
    data: { readAt: new Date() },
  });
}

export async function notificationCounts(organizationId: string, userId: string) {
  const [urgent, warning, unread] = await Promise.all([
    prisma.notification.count({
      where: { organizationId, userId, readAt: null, severity: "URGENT" },
    }),
    prisma.notification.count({
      where: { organizationId, userId, readAt: null, severity: "WARNING" },
    }),
    prisma.notification.count({
      where: { organizationId, userId, readAt: null },
    }),
  ]);
  return { urgent, warning, unread, total: unread };
}
