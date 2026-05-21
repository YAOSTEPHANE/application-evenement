import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { recordDocumentScan, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    return await handleAuthenticatedIdempotentPost(
      request,
      `stock-documents:scan:${id}`,
      async (ctx) => {
        const doc = await recordDocumentScan(ctx.organizationId, id, body);
        return { status: 200, body: doc };
      },
    );
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
