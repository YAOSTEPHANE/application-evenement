import { NextResponse } from "next/server";

import { getStockDocumentRulesPublicSpec } from "@/lib/cdc-stock-document-rules";

export async function GET() {
  return NextResponse.json(getStockDocumentRulesPublicSpec());
}
