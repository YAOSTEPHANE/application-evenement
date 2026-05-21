
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import { resolveBtTransferDispute, StockDocumentDbError } from "@/lib/stock-document-db";

const bodySchema = z.object({
  notes: z.string().max(2000).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireAuthenticatedContext();
    const { organizationId, actorId, role } = ctx;
    if (!actorId || !role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    await assertSensitiveActionAllowed(ctx);
    const { id } = await params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const doc = await resolveBtTransferDispute(
      organizationId,
      id,
      role,
      actorId,
      body.notes,
    );
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof SensitiveAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Corps de requête invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Arbitrage impossible" }, { status: 500 });
  }
}
