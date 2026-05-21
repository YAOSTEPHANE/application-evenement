import { NextResponse } from "next/server";

import { CDC_ORDER_LIFECYCLE } from "@/lib/cdc-order-lifecycle";

export async function GET() {
  return NextResponse.json({ lifecycle: CDC_ORDER_LIFECYCLE });
}
