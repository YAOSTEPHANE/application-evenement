import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { createVehicle, HrDbError, listVehicles } from "@/lib/hr-db";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    return NextResponse.json(await listVehicles(organizationId));
  } catch {
    return NextResponse.json({ message: "Impossible de charger les véhicules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
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
