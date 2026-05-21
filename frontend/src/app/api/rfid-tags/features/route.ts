import { NextResponse } from "next/server";

import { RFID_MODULE_FEATURES, RFID_PHYSICAL_STATE_HINT } from "@/lib/rfid-module-features";

export async function GET() {
  return NextResponse.json({
    features: RFID_MODULE_FEATURES,
    physicalStatesHint: RFID_PHYSICAL_STATE_HINT,
  });
}
