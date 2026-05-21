
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { ItemCondition, RfidTagType, TrackedAssetStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";


import { createTrackedAsset, listTrackedAssets, RfidDbError, suggestNextTagCode } from "@/lib/rfid-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { searchParams } = new URL(request.url);
    const suggest = searchParams.get("suggest");
    const categoryCode = searchParams.get("categoryCode") ?? "GEN";
    if (suggest === "1") {
      const code = await suggestNextTagCode(organizationId, categoryCode);
      return NextResponse.json({ tagCode: code });
    }
    const status = searchParams.get("status");
    const condition = searchParams.get("condition");
    const rfidTagType = searchParams.get("rfidTagType");
    const assets = await listTrackedAssets(organizationId, {
      q: searchParams.get("q") ?? undefined,
      warehouseId: searchParams.get("warehouseId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      status:
        status && status in TrackedAssetStatus ? (status as TrackedAssetStatus) : undefined,
      condition:
        condition && condition in ItemCondition ? (condition as ItemCondition) : undefined,
      rfidTagType:
        rfidTagType && rfidTagType in RfidTagType ? (rfidTagType as RfidTagType) : undefined,
    });
    return NextResponse.json(assets);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Impossible de charger les tags" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const asset = await createTrackedAsset(organizationId, body);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof RfidDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide", errors: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ message: "Impossible d'enregistrer le tag" }, { status: 500 });
  }
}
