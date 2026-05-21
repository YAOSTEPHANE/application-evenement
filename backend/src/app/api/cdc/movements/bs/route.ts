import { NextResponse } from "next/server";

import { getBsPublicSpec } from "@/lib/cdc-bs-document";

export async function GET() {
  return NextResponse.json(getBsPublicSpec());
}
