
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { exportDailyWorkersCsv } from "@/lib/document-archive";


export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const mark = searchParams.get("markSent") === "1";

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    const { csv, count } = await exportDailyWorkersCsv(organizationId, from, to, mark);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="journaliers-${new Date().toISOString().slice(0, 10)}.csv"`,
        "X-Row-Count": String(count),
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Export impossible" }, { status: 500 });
  }
}
