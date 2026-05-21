import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import { signStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const ctx = await getRequestContext();
    const { organizationId, actorId, role } = ctx;
    if (!actorId || !role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    await assertSensitiveActionAllowed(ctx);
    const { id } = await params;
    const doc = await signStockDocument(organizationId, id, actorId, role);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof SensitiveAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Signature impossible" }, { status: 500 });
  }
}
