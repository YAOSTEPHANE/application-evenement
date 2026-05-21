import { NextResponse } from "next/server";

import { getRfidPortalStats } from "@/lib/rfid-portal-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getRfidPortalStats(organizationId));
  } catch {
    return NextResponse.json({ message: "Statistiques portiques indisponibles" }, { status: 500 });
  }
}
