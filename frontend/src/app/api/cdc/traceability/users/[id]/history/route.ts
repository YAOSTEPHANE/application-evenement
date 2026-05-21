import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getUserFullHistory } from "@/lib/traceability-user-history";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { id } = await params;
    const history = await getUserFullHistory(organizationId, id);
    if (!history) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }
    return NextResponse.json(history);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Historique indisponible" }, { status: 500 });
  }
}
