import { NextResponse } from "next/server";

import { getHrStats } from "@/lib/hr-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getHrStats(organizationId));
  } catch {
    return NextResponse.json({ message: "Impossible de charger les indicateurs RH" }, { status: 500 });
  }
}
