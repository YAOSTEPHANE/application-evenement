import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { recordDocumentScan, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    const body = await request.json();
    const doc = await recordDocumentScan(organizationId, id, body);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Scan invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Échec du scan" }, { status: 500 });
  }
}
