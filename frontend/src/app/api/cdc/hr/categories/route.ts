import { NextResponse } from "next/server";

import { getPersonnelCategoriesSpec } from "@/lib/cdc-hr-personnel";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    await getRequestContext();
    return NextResponse.json(getPersonnelCategoriesSpec());
  } catch {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
