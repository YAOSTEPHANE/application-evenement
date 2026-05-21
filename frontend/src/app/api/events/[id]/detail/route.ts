import { NextResponse } from "next/server";

import { getEventOrderDetail } from "@/lib/event-order-db";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getEventOrderDetail(organizationId, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Détail indisponible";
    return NextResponse.json({ message }, { status: 404 });
  }
}
