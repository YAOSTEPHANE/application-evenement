import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { getValidationOverview } from "@/lib/validation-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await getValidationOverview(organizationId));
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Impossible de charger la validation" }, { status: 500 });
  }
}
