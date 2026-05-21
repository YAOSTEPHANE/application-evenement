
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { getCategoryAdminStats } from "@/lib/category-admin-stats-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await getCategoryAdminStats(organizationId));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Statistiques catégories indisponibles" }, { status: 500 });
  }
}
