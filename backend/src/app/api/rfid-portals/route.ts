
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRfidPortal,
  listRfidPortals,
  RfidPortalDbError,
} from "@/lib/rfid-portal-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const activeOnly = new URL(request.url).searchParams.get("active") === "1";
    return NextResponse.json(await listRfidPortals(organizationId, activeOnly));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Portiques indisponibles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const row = await createRfidPortal(organizationId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof RfidPortalDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Création portique impossible" }, { status: 500 });
  }
}
