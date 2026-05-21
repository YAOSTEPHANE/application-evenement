import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { assertSensitiveActionAllowed, SensitiveAuthError } from "@/lib/require-sensitive-auth";
import {
  createTerrainDocumentFromTags,
  terrainCreateDocumentSchema,
} from "@/lib/terrain-document-db";
import { StockDocumentDbError } from "@/lib/stock-document-db";

export async function POST(request: Request) {
  try {
    const ctx = await getRequestContext();
    if (!ctx.actorId || !ctx.role) {
      return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
    }
    await assertSensitiveActionAllowed(ctx);
    const body = await request.json();
    const parsed = terrainCreateDocumentSchema.parse(body);
    const doc = await createTerrainDocumentFromTags(
      ctx.organizationId,
      parsed,
      ctx.role,
    );
    return NextResponse.json(
      {
        id: doc.id,
        documentNumber: doc.documentNumber,
        kind: doc.kind,
        status: doc.status,
        clientTempId: parsed.clientTempId ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SensitiveAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Impossible de créer le bon" }, { status: 500 });
  }
}
