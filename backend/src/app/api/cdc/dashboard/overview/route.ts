import { NextResponse } from "next/server";

import { getDashboardOverview } from "@/lib/dashboard-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getDashboardOverview(organizationId));
  } catch {
    return NextResponse.json({ message: "Tableau de bord indisponible" }, { status: 500 });
  }
}
