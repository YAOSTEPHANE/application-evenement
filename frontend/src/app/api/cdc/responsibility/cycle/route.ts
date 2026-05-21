import { NextResponse } from "next/server";

import { getResponsibilityCycleSpec } from "@/lib/responsibility-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    await getRequestContext();
    return NextResponse.json(getResponsibilityCycleSpec());
  } catch {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
