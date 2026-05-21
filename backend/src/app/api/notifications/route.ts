
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";


import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationCounts,
} from "@/lib/notification-db";
import { isValidMongoObjectId } from "@/lib/mongo-id";

export async function GET(request: Request) {
  try {
    const { organizationId, actorId } = await requireAuthenticatedContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const [items, counts] = await Promise.all([
      listNotifications(organizationId, actorId, unreadOnly),
      notificationCounts(organizationId, actorId),
    ]);
    return NextResponse.json({ items, counts });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Impossible de charger les alertes" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, actorId } = await requireAuthenticatedContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const body = (await request.json()) as { id?: string; all?: boolean };
    if (body.all === true) {
      const marked = await markAllNotificationsRead(organizationId, actorId);
      return NextResponse.json({ ok: true, marked });
    }
    if (!body.id || !isValidMongoObjectId(body.id)) {
      return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
    }
    await markNotificationRead(organizationId, actorId, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 500 });
  }
}
