import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import { createShelvingNode, listShelvingNodes, ShelvingDbError } from "@/lib/shelving-db";

type RouteParams = { params: Promise<{ id: string; zoneId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId } = await params;
    if (!isValidMongoObjectId(warehouseId) || !isValidMongoObjectId(zoneId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const nodes = await listShelvingNodes(organizationId, warehouseId, zoneId);
    return NextResponse.json(nodes);
  } catch (error) {
    if (error instanceof ShelvingDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger les rayonnages" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId } = await params;
    if (!isValidMongoObjectId(warehouseId) || !isValidMongoObjectId(zoneId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const node = await createShelvingNode(organizationId, warehouseId, zoneId, body);
    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    if (error instanceof ShelvingDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de créer l'élément" }, { status: 500 });
  }
}
