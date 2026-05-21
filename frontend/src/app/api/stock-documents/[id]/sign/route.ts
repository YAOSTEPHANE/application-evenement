import { NextResponse } from "next/server";

import { handleSensitiveIdempotentPost } from "@/lib/api-route-helpers";
import { signStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    return await handleSensitiveIdempotentPost(
      request,
      `stock-documents:sign:${id}`,
      async (ctx) => {
        if (!ctx.role) {
          return { status: 401, body: { message: "Session requise" } };
        }
        const doc = await signStockDocument(
          ctx.organizationId,
          id,
          ctx.actorId,
          ctx.role,
        );
        return { status: 200, body: doc };
      },
    );
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Signature impossible" }, { status: 500 });
  }
}
