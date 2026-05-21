import { NextResponse } from "next/server";

import { resolveCurrentCustodian } from "@/lib/responsibility-db";
import { getRequestContext } from "@/lib/request-context";

export async function GET(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const { searchParams } = new URL(request.url);
    const trackedAssetId = searchParams.get("trackedAssetId") ?? undefined;
    const tagCode = searchParams.get("tagCode") ?? undefined;
    if (!trackedAssetId && !tagCode) {
      return NextResponse.json(
        { message: "Paramètre trackedAssetId ou tagCode requis" },
        { status: 400 },
      );
    }
    const custodian = await resolveCurrentCustodian(organizationId, {
      trackedAssetId,
      tagCode,
    });
    if (!custodian) {
      return NextResponse.json({ message: "Unité ou détenteur introuvable" }, { status: 404 });
    }
    return NextResponse.json(custodian);
  } catch {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
}
