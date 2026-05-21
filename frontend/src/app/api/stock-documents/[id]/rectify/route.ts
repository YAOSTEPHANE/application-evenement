
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import { createRectificatoryDocument, StockDocumentDbError } from "@/lib/stock-document-db";

const bodySchema = z.object({
  reason: z.string().min(3).max(500),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireAuthenticatedContext();
    const { organizationId, role } = ctx;
    if (!role) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    await assertSensitiveActionAllowed(ctx);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const doc = await createRectificatoryDocument(organizationId, id, role, body.reason);
    return NextResponse.json(doc, { status: 201 });
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
      return NextResponse.json({ message: "Motif invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Rectificatif impossible" }, { status: 500 });
  }
}
