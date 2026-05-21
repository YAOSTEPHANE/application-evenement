
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { RfidDbError, runInventorySample } from "@/lib/rfid-db";

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const result = await runInventorySample(organizationId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof RfidDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Inventaire sondage impossible" }, { status: 500 });
  }
}
