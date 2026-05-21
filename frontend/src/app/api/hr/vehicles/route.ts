
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";


import { createVehicle, HrDbError, listVehicles } from "@/lib/hr-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await listVehicles(organizationId));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Impossible de charger les véhicules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const vehicle = await createVehicle(organizationId, body);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (error instanceof HrDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Création impossible" }, { status: 500 });
  }
}
