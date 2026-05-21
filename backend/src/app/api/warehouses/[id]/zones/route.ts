
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";

import {
  createStorageZone,
  listStorageZones,
  StorageZoneDbError,
} from "@/lib/warehouse-zone-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId } = await params;
    if (!isValidMongoObjectId(warehouseId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await requireAuthenticatedContext();
    const zones = await listStorageZones(organizationId, warehouseId);
    return NextResponse.json(zones);
  } catch (error) {
    if (error instanceof StorageZoneDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger les zones" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId } = await params;
    if (!isValidMongoObjectId(warehouseId)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const zone = await createStorageZone(organizationId, warehouseId, body);
    return NextResponse.json(zone, { status: 201 });
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
    return NextResponse.json({ message: "Impossible de créer la zone" }, { status: 500 });
  }
}
