import { NextResponse } from "next/server";

import { getDirectingPrinciplePublic } from "@/lib/cdc-directing-principle";

export async function GET() {
  return NextResponse.json(getDirectingPrinciplePublic());
}
