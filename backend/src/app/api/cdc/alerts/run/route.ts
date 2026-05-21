import { NextResponse } from "next/server";

import { runCdcScheduledAlerts } from "@/lib/cdc-alerts";
import { prisma } from "@/lib/prisma";

/** Cron CDC — header Authorization: Bearer {CDC_CRON_SECRET} */
export async function POST(request: Request) {
  const secret = process.env.CDC_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ message: "CDC_CRON_SECRET non configuré" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const results = [];
  for (const org of orgs) {
    results.push({ organizationId: org.id, ...(await runCdcScheduledAlerts(org.id)) });
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
