import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizePortalCode } from "@/lib/rfid-portal-helpers";
import { portalScanBodySchema } from "@/lib/rfid-portal-scan";
import { getRequestContext } from "@/lib/request-context";
import { StockDocumentDbError, validatePortalScan } from "@/lib/stock-document-db";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { organizationId } = await getRequestContext();
    const { code } = await params;
    const body = portalScanBodySchema.parse(await request.json());
    const result = await validatePortalScan(organizationId, body.tagCodes, {
      portalCode: normalizePortalCode(code),
      warehouseId: body.warehouseId,
    });
    return NextResponse.json(result, { status: result.allowed ? 200 : 422 });
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
