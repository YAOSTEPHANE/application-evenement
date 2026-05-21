import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import {
  HANDHELD_CDC_CAPABILITIES,
  HANDHELD_EQUIPMENT_DOC,
  PORTAL_CDC_CAPABILITIES,
  PORTAL_EQUIPMENT_DOC,
} from "@/lib/rfid-reading-equipment";
import { RFID_TAG_TYPOLOGY } from "@/lib/rfid-tag-typology";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json({
      portals: { doc: PORTAL_EQUIPMENT_DOC, capabilities: PORTAL_CDC_CAPABILITIES },
      handhelds: { doc: HANDHELD_EQUIPMENT_DOC, capabilities: HANDHELD_CDC_CAPABILITIES },
      tagTypology: RFID_TAG_TYPOLOGY,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
