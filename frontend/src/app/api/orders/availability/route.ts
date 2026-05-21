
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { getCatalogAvailability } from "@/lib/event-order-db";
import { isValidMongoObjectId } from "@/lib/mongo-id";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { searchParams } = new URL(request.url);
    const startsAt = searchParams.get("startsAt");
    const endsAt = searchParams.get("endsAt");
    const excludeEventId = searchParams.get("excludeEventId") ?? undefined;

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { message: "Paramètres startsAt et endsAt requis" },
        { status: 400 },
      );
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ message: "Période invalide" }, { status: 400 });
    }

    if (excludeEventId && !isValidMongoObjectId(excludeEventId)) {
      return NextResponse.json({ message: "ObjectId invalide" }, { status: 400 });
    }

    const rows = await getCatalogAvailability(organizationId, start, end, excludeEventId);
    return NextResponse.json(rows);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Disponibilités indisponibles" }, { status: 500 });
  }
}
