import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { runCdcScheduledAlerts } from "@/lib/cdc-alerts";
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";

/** Déclenchement manuel des alertes planifiées CDC (administrateurs). */
export async function POST() {
  try {
    const { organizationId, actorId, role } = await requireAuthenticatedContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    if (role !== Role.ADMIN && role !== Role.MANAGER) {
      return NextResponse.json({ message: "Droits insuffisants" }, { status: 403 });
    }
    const result = await runCdcScheduledAlerts(organizationId);
    return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: "Exécution des alertes impossible" }, { status: 500 });
  }
}
