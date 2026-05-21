import { StockDocumentKind, StockDocumentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import { getRequestContext } from "@/lib/request-context";
import {
  createStockDocument,
  listStockDocuments,
  StockDocumentDbError,
} from "@/lib/stock-document-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const status = searchParams.get("status");
    const eventId = searchParams.get("eventId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const documents = await listStockDocuments(organizationId, {
      kind: kind && kind in StockDocumentKind ? (kind as StockDocumentKind) : undefined,
      status:
        status && status in StockDocumentStatus ? (status as StockDocumentStatus) : undefined,
      eventId,
      search,
    });
    return NextResponse.json(documents);
  } catch {
    return NextResponse.json({ message: "Impossible de charger les bons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getRequestContext();
    const { organizationId, role } = ctx;
    const body = await request.json();
    if (body?.kind === "BS" || body?.kind === "BT") {
      await assertSensitiveActionAllowed(ctx);
    }
    const doc = await createStockDocument(organizationId, body, role ?? undefined);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof SensitiveAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide", errors: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ message: "Impossible de créer le bon" }, { status: 500 });
  }
}
