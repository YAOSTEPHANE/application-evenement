import { NextResponse } from "next/server";

import { getMobileOfflineSpec } from "@/lib/cdc-mobile-offline";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    await getRequestContext();
    return NextResponse.json(getMobileOfflineSpec());
  } catch {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
