import { NextResponse } from "next/server";

import { buildCdcKpis } from "@/lib/cdc-kpis-db";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await buildCdcKpis(organizationId));
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "KPIs indisponibles" }, { status: 500 });
  }
}
