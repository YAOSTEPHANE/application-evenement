import { NextResponse } from "next/server";

import { getDashboardOverview } from "@/lib/dashboard-db";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await getDashboardOverview(organizationId));
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Tableau de bord indisponible" }, { status: 500 });
  }
}
