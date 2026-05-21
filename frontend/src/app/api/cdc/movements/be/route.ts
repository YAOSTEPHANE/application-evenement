import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import {
  CDC_BE_MANDATORY_FIELDS,
  CDC_BE_PROCESSING_STEPS,
  CDC_BE_SUBTYPES,
  CDC_BE_SUMMARY,
  CDC_BE_TITLE,
} from "@/lib/cdc-be-document";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json({
      title: CDC_BE_TITLE,
      summary: CDC_BE_SUMMARY,
      subtypes: CDC_BE_SUBTYPES,
      mandatoryFields: CDC_BE_MANDATORY_FIELDS,
      processingSteps: CDC_BE_PROCESSING_STEPS,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
