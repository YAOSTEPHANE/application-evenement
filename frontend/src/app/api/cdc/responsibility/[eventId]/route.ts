import { NextResponse } from "next/server";

import { detectEventChainAnomalies } from "@/lib/responsibility-anomalies";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { buildEventResponsibilityChain } from "@/lib/responsibility-chain";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { eventId } = await params;
    const [chain, anomalies] = await Promise.all([
      buildEventResponsibilityChain(organizationId, eventId),
      detectEventChainAnomalies(organizationId, eventId),
    ]);
    return NextResponse.json({ ...chain, anomalies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chaîne indisponible";
    return NextResponse.json({ message }, { status: 404 });
  }
}
