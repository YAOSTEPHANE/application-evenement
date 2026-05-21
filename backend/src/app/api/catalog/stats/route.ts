import { NextResponse } from "next/server";

import { getCatalogStats } from "@/lib/catalog-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getCatalogStats(organizationId));
  } catch {
    return NextResponse.json({ message: "Statistiques catalogue indisponibles" }, { status: 500 });
  }
}
