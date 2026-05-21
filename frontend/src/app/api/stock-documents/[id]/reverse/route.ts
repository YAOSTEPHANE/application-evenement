import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSensitiveActionAllowed } from "@/lib/require-sensitive-auth";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { getRequestContext } from "@/lib/request-context";
import { createContraDocument, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await getRequestContext();
    await assertSensitiveActionAllowed(ctx);
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    if (!ctx.role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const body = z.object({ reason: z.string().min(3).max(500) }).parse(await request.json());
    const doc = await createContraDocument(
      ctx.organizationId,
      id,
      ctx.role,
      body.reason,
    );
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Contre-passation impossible" }, { status: 500 });
  }
}
