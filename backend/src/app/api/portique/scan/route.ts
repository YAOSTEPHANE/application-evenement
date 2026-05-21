import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { portalScanBodySchema, portalScanOptionsFromBody } from "@/lib/rfid-portal-scan";
import { StockDocumentDbError, validatePortalScan } from "@/lib/stock-document-db";

export async function POST(request: Request) {
  try {
    const body = portalScanBodySchema.parse(await request.json());
    const portalId = body.portalId ?? body.portalCode ?? "default";

    return await handleAuthenticatedIdempotentPost(
      request,
      `portique:scan:${portalId}`,
      async (ctx) => {
        const result = await validatePortalScan(
          ctx.organizationId,
          body.tagCodes,
          portalScanOptionsFromBody(body),
        );
        return { status: result.allowed ? 200 : 422, body: result };
      },
    );
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Scan portique impossible" }, { status: 500 });
  }
}
