
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import {
  getLocationStockSummary,
  listLocationStockBalances,
  LocationStockDbError,
  upsertLocationStockBalance,
} from "@/lib/location-stock-db";


export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const url = new URL(request.url);
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
    const storageZoneId = url.searchParams.get("storageZoneId") ?? undefined;
    const storageLocationId = url.searchParams.get("storageLocationId") ?? undefined;
    const itemId = url.searchParams.get("itemId") ?? undefined;
    const summary = url.searchParams.get("summary") === "1";

    for (const id of [warehouseId, storageZoneId, storageLocationId, itemId]) {
      if (id && !isValidMongoObjectId(id)) {
        return jsonInvalidObjectIdResponse();
      }
    }

    if (summary) {
      const data = await getLocationStockSummary(
        organizationId,
        warehouseId && isValidMongoObjectId(warehouseId) ? warehouseId : undefined,
      );
      return NextResponse.json(data);
    }

    const lines = await listLocationStockBalances(organizationId, {
      warehouseId,
      storageZoneId,
      storageLocationId,
      itemId,
    });
    return NextResponse.json(lines);
  } catch (error) {
    if (error instanceof LocationStockDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger le stock par localisation" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const row = await upsertLocationStockBalance(organizationId, body);
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof LocationStockDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible d'enregistrer le stock" }, { status: 500 });
  }
}
