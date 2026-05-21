import type { NotificationChannel, NotificationSeverity, Prisma } from "@prisma/client";

import { createNotification } from "@/lib/notification-db";
import { prisma } from "@/lib/prisma";

export type DispatchChannels = NotificationChannel[];

type DispatchParams = {
  organizationId: string;
  userId: string;
  module: string;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  severity?: NotificationSeverity;
  channels?: DispatchChannels;
};

async function sendEmailWebhook(payload: {
  toUserId: string;
  title: string;
  body: string;
}): Promise<void> {
  const url = process.env.CDC_EMAIL_WEBHOOK_URL?.trim();
  if (!url) return;
  const user = await prisma.user.findUnique({
    where: { id: payload.toUserId },
    select: { email: true, fullName: true },
  });
  if (!user?.email) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: user.email,
        name: user.fullName,
        subject: payload.title,
        text: payload.body,
      }),
    });
  } catch {
    /* webhook optionnel */
  }
}

async function sendWhatsAppWebhook(payload: {
  toUserId: string;
  title: string;
  body: string;
}): Promise<void> {
  const url = process.env.CDC_WHATSAPP_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: payload.toUserId,
        message: `${payload.title}\n${payload.body}`,
      }),
    });
  } catch {
    /* webhook optionnel */
  }
}

/** Notification CDC : in-app + canaux externes si configurés */
export async function dispatchCdcNotification(
  db: Prisma.TransactionClient | typeof prisma,
  params: DispatchParams,
) {
  const channels = params.channels ?? ["IN_APP", "EMAIL", "WHATSAPP"];
  const inApp = await createNotification(db, {
    organizationId: params.organizationId,
    userId: params.userId,
    module: params.module,
    title: params.title,
    body: params.body,
    targetType: params.targetType,
    targetId: params.targetId,
    severity: params.severity,
  });

  if (channels.includes("EMAIL")) {
    await sendEmailWebhook({
      toUserId: params.userId,
      title: params.title,
      body: params.body,
    });
  }
  if (channels.includes("WHATSAPP")) {
    await sendWhatsAppWebhook({
      toUserId: params.userId,
      title: params.title,
      body: params.body,
    });
  }

  return inApp;
}

export async function notifyRoleGroup(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  roles: string[],
  params: Omit<DispatchParams, "userId" | "organizationId">,
) {
  const users = await db.user.findMany({
    where: { organizationId, active: true, role: { in: roles as never[] } },
    select: { id: true },
  });
  for (const u of users) {
    await dispatchCdcNotification(db, {
      organizationId,
      userId: u.id,
      ...params,
    });
  }
}
