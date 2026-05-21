import { NextResponse } from "next/server";

import { buildCdcKpis } from "@/lib/cdc-kpis-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await buildCdcKpis(organizationId));
  } catch {
    return NextResponse.json({ message: "KPIs indisponibles" }, { status: 500 });
  }
}
