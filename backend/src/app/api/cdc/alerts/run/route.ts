import { NextResponse } from "next/server";

import { ApiAuthError, assertCronSecret } from "@/lib/api-auth";
import { runCdcScheduledAlerts } from "@/lib/cdc-alerts";
import { prisma } from "@/lib/prisma";

/** Cron CDC — header Authorization: Bearer {CDC_CRON_SECRET} */
export async function POST(request: Request) {
  try {
    assertCronSecret(request);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const results = [];
  for (const org of orgs) {
    results.push({ organizationId: org.id, ...(await runCdcScheduledAlerts(org.id)) });
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
