import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getStockDocumentRulesPublicSpec } from "@/lib/cdc-stock-document-rules";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json(getStockDocumentRulesPublicSpec());
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
