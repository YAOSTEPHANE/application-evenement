import { NextResponse } from "next/server";
import { z } from "zod";

import { portalScanBodySchema, portalScanOptionsFromBody } from "@/lib/rfid-portal-scan";
import { getRequestContext } from "@/lib/request-context";
import { StockDocumentDbError, validatePortalScan } from "@/lib/stock-document-db";

export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const body = portalScanBodySchema.parse(await request.json());
    const result = await validatePortalScan(
      organizationId,
      body.tagCodes,
      portalScanOptionsFromBody(body),
    );
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
