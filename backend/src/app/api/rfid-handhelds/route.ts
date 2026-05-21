
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRfidHandheld,
  listRfidHandhelds,
  RfidHandheldDbError,
} from "@/lib/rfid-handheld-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const activeOnly = new URL(request.url).searchParams.get("active") === "1";
    return NextResponse.json(await listRfidHandhelds(organizationId, activeOnly));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Douchettes indisponibles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const row = await createRfidHandheld(organizationId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof RfidHandheldDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Création douchette impossible" }, { status: 500 });
  }
}
