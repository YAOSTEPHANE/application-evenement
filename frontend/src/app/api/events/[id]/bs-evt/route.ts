import { NextResponse } from "next/server";

import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import { createBsEvtFromEvent, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();
    const doc = await createBsEvtFromEvent(organizationId, id);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de créer le BS-EVT" }, { status: 500 });
  }
}
