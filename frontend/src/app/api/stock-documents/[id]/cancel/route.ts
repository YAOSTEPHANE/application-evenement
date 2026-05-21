
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";

import { cancelStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireAuthenticatedContext();
    await assertSensitiveActionAllowed(ctx);
    const { organizationId, role } = ctx;
    if (!role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const { id } = await params;
    const body = z.object({ reason: z.string().max(500).optional() }).parse(await request.json().catch(() => ({})));
    const doc = await cancelStockDocument(organizationId, id, role, body.reason);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof SensitiveAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Annulation impossible" }, { status: 500 });
  }
}
