import { NextResponse } from "next/server";

import { getRfidHandheldStats } from "@/lib/rfid-handheld-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getRfidHandheldStats(organizationId));
  } catch {
    return NextResponse.json({ message: "Statistiques douchettes indisponibles" }, { status: 500 });
  }
}
