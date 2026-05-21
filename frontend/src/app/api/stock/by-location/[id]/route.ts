
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { deleteLocationStockBalance, LocationStockDbError } from "@/lib/location-stock-db";


type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await requireAuthenticatedContext();
    await deleteLocationStockBalance(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LocationStockDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de supprimer la ligne" }, { status: 500 });
  }
}
