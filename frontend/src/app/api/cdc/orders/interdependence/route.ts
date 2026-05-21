import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import {
  CDC_ORDER_INTERDEPENDENCE_RULES,
  CDC_ORDER_INTERDEPENDENCE_SUMMARY,
} from "@/lib/cdc-order-interdependence";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json({
      summary: CDC_ORDER_INTERDEPENDENCE_SUMMARY,
      rules: CDC_ORDER_INTERDEPENDENCE_RULES,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
