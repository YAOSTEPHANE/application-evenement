import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { getStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    const doc = await getStockDocument(organizationId, id);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Bon introuvable" }, { status: 500 });
  }
}
