import { NextResponse } from "next/server";

import {
  CDC_ORDER_INTERDEPENDENCE_RULES,
  CDC_ORDER_INTERDEPENDENCE_SUMMARY,
} from "@/lib/cdc-order-interdependence";

export async function GET() {
  return NextResponse.json({
    summary: CDC_ORDER_INTERDEPENDENCE_SUMMARY,
    rules: CDC_ORDER_INTERDEPENDENCE_RULES,
  });
}
