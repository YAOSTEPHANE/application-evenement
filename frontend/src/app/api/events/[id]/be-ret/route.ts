import { NextResponse } from "next/server";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { createBeRetFromEvent, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }

    return await handleAuthenticatedIdempotentPost(
      request,
      `events:be-ret:${id}`,
      async (ctx) => {
        const doc = await createBeRetFromEvent(ctx.organizationId, id);
        return { status: 201, body: doc };
      },
    );
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de créer le BE-RET" }, { status: 500 });
  }
}
