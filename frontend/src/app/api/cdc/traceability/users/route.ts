import { NextResponse } from "next/server";

import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { listTraceabilityUsers } from "@/lib/traceability-user-history";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    const users = await listTraceabilityUsers(organizationId, q);
    return NextResponse.json(users);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Liste indisponible" }, { status: 500 });
  }
}
