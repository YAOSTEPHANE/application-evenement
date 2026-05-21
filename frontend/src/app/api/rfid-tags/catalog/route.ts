import { RfidTagType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getRequestContext } from "@/lib/request-context";
import { listRfidCatalog } from "@/lib/rfid-db";

function parseTagType(value: string | null): RfidTagType | undefined {
  if (!value || !(value in RfidTagType)) return undefined;
  return value as RfidTagType;
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const { searchParams } = new URL(request.url);
    const rows = await listRfidCatalog(organizationId, {
      q: searchParams.get("q") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      defaultRfidTagType: parseTagType(searchParams.get("defaultRfidTagType")),
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: "Catalogue RFID indisponible" }, { status: 500 });
  }
}
