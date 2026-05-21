import { NextResponse } from "next/server";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { startEventLoading, StockDocumentDbError } from "@/lib/stock-document-db";

type RouteParams = { params: Promise<{ id: string }> };

/** Chargement : génération automatique du BS-EVT (commande → sortie matériel). */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }

    return await handleAuthenticatedIdempotentPost(
      request,
      `events:loading:${id}`,
      async (ctx) => {
        const doc = await startEventLoading(ctx.organizationId, id);
        return { status: 201, body: doc };
      },
    );
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Chargement impossible" }, { status: 500 });
  }
}
