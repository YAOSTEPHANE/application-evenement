import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import {
  listNotifications,
  markNotificationRead,
  notificationCounts,
} from "@/lib/notification-db";
import { isValidMongoObjectId } from "@/lib/mongo-id";

export async function GET(request: Request) {
  try {
    const { organizationId, actorId } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const [items, counts] = await Promise.all([
      listNotifications(organizationId, actorId, unreadOnly),
      notificationCounts(organizationId, actorId),
    ]);
    return NextResponse.json({ items, counts });
  } catch {
    return NextResponse.json({ message: "Impossible de charger les alertes" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, actorId } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const body = (await request.json()) as { id?: string };
    if (!body.id || !isValidMongoObjectId(body.id)) {
      return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
    }
    await markNotificationRead(organizationId, actorId, body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 500 });
  }
}
