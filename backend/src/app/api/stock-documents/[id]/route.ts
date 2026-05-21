
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";

import {
  getStockDocument,
  StockDocumentDbError,
  updateDocumentLineCondition,
  updateStockDocumentMeta,
} from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const doc = await getStockDocument(organizationId, id);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Bon introuvable" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const body = await request.json();
    if (body && typeof body === "object" && "lineId" in body && "lineCondition" in body) {
      const doc = await updateDocumentLineCondition(organizationId, id, body);
      return NextResponse.json(doc);
    }
    const doc = await updateStockDocumentMeta(organizationId, id, body);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 400 });
  }
}
