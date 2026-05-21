import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { normalizePortalCode } from "@/lib/rfid-portal-helpers";
import { portalScanBodySchema } from "@/lib/rfid-portal-scan";
import { StockDocumentDbError, validatePortalScan } from "@/lib/stock-document-db";

type Params = { params: Promise<{ code: string }> };

/** Point d'entrée matériel : POST /api/rfid-portals/by-code/{code}/scan */
export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const body = portalScanBodySchema.parse(await request.json());
    const portalCode = normalizePortalCode(code);

    return await handleAuthenticatedIdempotentPost(
      request,
      `rfid-portal:scan:${portalCode}`,
      async (ctx) => {
        const result = await validatePortalScan(ctx.organizationId, body.tagCodes, {
          portalCode,
          warehouseId: body.warehouseId,
        });
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
