import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import {
  deleteStorageLocation,
  getStorageLocation,
  StorageLocationDbError,
  updateStorageLocation,
} from "@/lib/storage-location-db";

type RouteParams = { params: Promise<{ id: string; zoneId: string; locationId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, locationId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(locationId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const location = await getStorageLocation(organizationId, warehouseId, zoneId, locationId);
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof StorageLocationDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger l'emplacement" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, locationId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(locationId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const location = await updateStorageLocation(
      organizationId,
      warehouseId,
      zoneId,
      locationId,
      body,
    );
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof StorageLocationDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier l'emplacement" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: warehouseId, zoneId, locationId } = await params;
    if (
      !isValidMongoObjectId(warehouseId) ||
      !isValidMongoObjectId(zoneId) ||
      !isValidMongoObjectId(locationId)
    ) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    await deleteStorageLocation(organizationId, warehouseId, zoneId, locationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageLocationDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de supprimer l'emplacement" }, { status: 500 });
  }
}
