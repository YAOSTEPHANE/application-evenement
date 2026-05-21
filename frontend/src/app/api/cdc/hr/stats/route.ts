import { NextResponse } from "next/server";

import { getHrStats } from "@/lib/hr-db";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await getHrStats(organizationId));
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Impossible de charger les indicateurs RH" }, { status: 500 });
  }
}
