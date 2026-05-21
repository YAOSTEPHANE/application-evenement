import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getAssetFullHistory } from "@/lib/traceability-asset-history";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { id } = await params;
    const history = await getAssetFullHistory(organizationId, id);
    if (!history) {
      return NextResponse.json({ message: "Unité introuvable" }, { status: 404 });
    }
    return NextResponse.json(history);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Historique indisponible" }, { status: 500 });
  }
}
