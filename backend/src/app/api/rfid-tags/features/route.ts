import { NextResponse } from "next/server";

import { RFID_MODULE_FEATURES } from "@/lib/rfid-module-features";

export async function GET() {
  return NextResponse.json({ features: RFID_MODULE_FEATURES });
}
