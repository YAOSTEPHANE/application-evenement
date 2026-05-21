import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { CDC_ORDER_LIFECYCLE } from "@/lib/cdc-order-lifecycle";

export async function GET() {
  try {
    await requireAuthenticatedContext();
    return NextResponse.json({ lifecycle: CDC_ORDER_LIFECYCLE });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
