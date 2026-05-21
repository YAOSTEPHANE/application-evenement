import { NextResponse } from "next/server";

import {
  HANDHELD_CDC_CAPABILITIES,
  HANDHELD_EQUIPMENT_DOC,
  PORTAL_CDC_CAPABILITIES,
  PORTAL_EQUIPMENT_DOC,
} from "@/lib/rfid-reading-equipment";
import { RFID_TAG_TYPOLOGY } from "@/lib/rfid-tag-typology";

export async function GET() {
  return NextResponse.json({
    portals: { doc: PORTAL_EQUIPMENT_DOC, capabilities: PORTAL_CDC_CAPABILITIES },
    handhelds: { doc: HANDHELD_EQUIPMENT_DOC, capabilities: HANDHELD_CDC_CAPABILITIES },
    tagTypology: RFID_TAG_TYPOLOGY,
  });
}
