import { NextResponse } from "next/server";

import { getResponsibilityCycleSpec } from "@/lib/responsibility-db";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json(getResponsibilityCycleSpec());
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
