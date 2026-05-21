import { NextResponse } from "next/server";

import { getStockDocumentsKpis } from "@/lib/stock-document-kpis";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getStockDocumentsKpis(organizationId));
  } catch {
    return NextResponse.json({ message: "KPIs mouvements indisponibles" }, { status: 500 });
  }
}
