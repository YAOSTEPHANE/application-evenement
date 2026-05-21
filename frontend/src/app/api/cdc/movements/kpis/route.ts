import { NextResponse } from "next/server";

import { getStockDocumentsKpis } from "@/lib/stock-document-kpis";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await getStockDocumentsKpis(organizationId));
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "KPIs mouvements indisponibles" }, { status: 500 });
  }
}
