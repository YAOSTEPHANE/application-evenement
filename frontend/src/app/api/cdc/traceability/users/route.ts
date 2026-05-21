import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { listTraceabilityUsers } from "@/lib/traceability-user-history";

export async function GET(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    const users = await listTraceabilityUsers(organizationId, q);
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ message: "Liste indisponible" }, { status: 500 });
  }
}
