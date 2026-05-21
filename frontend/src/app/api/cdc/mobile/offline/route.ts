import { NextResponse } from "next/server";

import { getMobileOfflineSpec } from "@/lib/cdc-mobile-offline";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json(getMobileOfflineSpec());
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
