import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { listEventTraceability, listRecentCustodyLogs } from "@/lib/traceability-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get("logs") === "1";
    const activeOnly = searchParams.get("active") === "1";

    const events = await listEventTraceability(organizationId, { activeOnly });
    if (!includeLogs) {
      return NextResponse.json({ events });
    }
    const custodyLogs = await listRecentCustodyLogs(organizationId, 50);
    return NextResponse.json({ events, custodyLogs });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Données traçabilité indisponibles" }, { status: 500 });
  }
}
