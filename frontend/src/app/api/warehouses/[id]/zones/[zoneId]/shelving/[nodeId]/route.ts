import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import {
  deleteShelvingNode,
  getShelvingNode,
  ShelvingDbError,
  updateShelvingNode,
} from "@/lib/shelving-db";

type RouteParams = { params: Promise<{ id: string; zoneId: string; nodeId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, nodeId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(nodeId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const node = await getShelvingNode(organizationId, warehouseId, zoneId, nodeId);
    return NextResponse.json(node);
  } catch (error) {
    if (error instanceof ShelvingDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger l'élément" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, nodeId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(nodeId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const node = await updateShelvingNode(organizationId, warehouseId, zoneId, nodeId, body);
    return NextResponse.json(node);
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
    return NextResponse.json({ message: "Impossible de modifier l'élément" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, nodeId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(nodeId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    await deleteShelvingNode(organizationId, warehouseId, zoneId, nodeId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ShelvingDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de supprimer l'élément" }, { status: 500 });
  }
}
