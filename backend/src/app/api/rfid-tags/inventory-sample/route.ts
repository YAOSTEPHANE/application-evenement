import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { RfidDbError, runInventorySample } from "@/lib/rfid-db";

export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const result = await runInventorySample(organizationId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RfidDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Inventaire sondage impossible" }, { status: 500 });
  }
}
