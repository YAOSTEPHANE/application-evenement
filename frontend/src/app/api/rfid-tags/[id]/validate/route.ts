import { NextResponse } from "next/server";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import { RfidDbError, validateTrackedAssetTagCode } from "@/lib/rfid-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId, actorId } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Authentification requise" }, { status: 401 });
    }
    const asset = await validateTrackedAssetTagCode(organizationId, id, actorId);
    return NextResponse.json(asset);
  } catch (error) {
    if (error instanceof RfidDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Validation impossible" }, { status: 500 });
  }
}
