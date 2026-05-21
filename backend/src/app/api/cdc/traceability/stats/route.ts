import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { getTraceabilityStats } from "@/lib/traceability-db";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    const stats = await getTraceabilityStats(organizationId);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ message: "Statistiques traçabilité indisponibles" }, { status: 500 });
  }
}
