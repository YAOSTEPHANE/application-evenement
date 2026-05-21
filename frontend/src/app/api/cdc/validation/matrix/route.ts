import { NextResponse } from "next/server";

import { getValidationMatrixCatalog } from "@/lib/cdc-validation-principle";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json(getValidationMatrixCatalog());
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
