import { NextResponse } from "next/server";

import { getValidationMatrixCatalog } from "@/lib/cdc-validation-principle";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    await getRequestContext();
    return NextResponse.json(getValidationMatrixCatalog());
  } catch {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
