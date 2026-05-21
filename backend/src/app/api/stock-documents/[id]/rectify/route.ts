import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { createRectificatoryDocument, StockDocumentDbError } from "@/lib/stock-document-db";

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { organizationId, role } = await getRequestContext();
    if (!role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const doc = await createRectificatoryDocument(organizationId, id, role, body.reason);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Rectificatif impossible" }, { status: 500 });
  }
}
