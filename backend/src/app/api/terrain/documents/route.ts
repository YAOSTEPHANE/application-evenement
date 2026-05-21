import { NextResponse } from "next/server";
import { z } from "zod";

import { handleSensitiveIdempotentPost } from "@/lib/api-route-helpers";
import {
  createTerrainDocumentFromTags,
  terrainCreateDocumentSchema,
} from "@/lib/terrain-document-db";
import { StockDocumentDbError } from "@/lib/stock-document-db";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = terrainCreateDocumentSchema.parse(rawBody);

    return await handleSensitiveIdempotentPost(request, "terrain:documents", async (ctx) => {
      const doc = await createTerrainDocumentFromTags(
        ctx.organizationId,
        parsed,
        ctx.role ?? undefined,
      );
      return {
        status: 201,
        body: {
          id: doc.id,
          documentNumber: doc.documentNumber,
          kind: doc.kind,
          status: doc.status,
          clientTempId: parsed.clientTempId ?? null,
        },
      };
    });
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Impossible de créer le bon" }, { status: 500 });
  }
}
