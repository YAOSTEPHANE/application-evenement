import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getBtPublicSpec } from "@/lib/cdc-bt-document";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json(getBtPublicSpec());
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
