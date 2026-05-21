import { NextResponse } from "next/server";

import { getCategoryAdminStats } from "@/lib/category-admin-stats-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getCategoryAdminStats(organizationId));
  } catch {
    return NextResponse.json({ message: "Statistiques catégories indisponibles" }, { status: 500 });
  }
}
