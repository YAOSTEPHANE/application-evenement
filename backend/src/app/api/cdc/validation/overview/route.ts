import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { getValidationOverview } from "@/lib/validation-db";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await getValidationOverview(organizationId));
  } catch {
    return NextResponse.json({ message: "Impossible de charger la validation" }, { status: 500 });
  }
}
