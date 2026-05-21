import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import {
  deleteStorageZone,
  getStorageZone,
  StorageZoneDbError,
  updateStorageZone,
} from "@/lib/warehouse-zone-db";

type RouteParams = { params: Promise<{ id: string; zoneId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId } = await params;
    if (!isValidMongoObjectId(warehouseId) || !isValidMongoObjectId(zoneId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const zone = await getStorageZone(organizationId, warehouseId, zoneId);
    return NextResponse.json(zone);
  } catch (error) {
    if (error instanceof StorageZoneDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger la zone" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId } = await params;
    if (!isValidMongoObjectId(warehouseId) || !isValidMongoObjectId(zoneId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const zone = await updateStorageZone(organizationId, warehouseId, zoneId, body);
    return NextResponse.json(zone);
  } catch (error) {
    if (error instanceof StorageZoneDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier la zone" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId } = await params;
    if (!isValidMongoObjectId(warehouseId) || !isValidMongoObjectId(zoneId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    await deleteStorageZone(organizationId, warehouseId, zoneId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageZoneDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de supprimer la zone" }, { status: 500 });
  }
}
