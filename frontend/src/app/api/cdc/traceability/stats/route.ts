import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getTraceabilityStats } from "@/lib/traceability-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const stats = await getTraceabilityStats(organizationId);
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Statistiques traçabilité indisponibles" }, { status: 500 });
  }
}
