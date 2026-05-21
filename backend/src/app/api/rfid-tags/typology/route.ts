import { NextResponse } from "next/server";

import { RFID_TAG_TYPOLOGY } from "@/lib/rfid-tag-typology";

/** Référentiel CDC §5.2 — typologie des supports RFID (lecture seule). */
export async function GET() {
  return NextResponse.json({ typology: RFID_TAG_TYPOLOGY });
}
