import { NextResponse } from "next/server";

import { getBtPublicSpec } from "@/lib/cdc-bt-document";

export async function GET() {
  return NextResponse.json(getBtPublicSpec());
}
