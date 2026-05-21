
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { HrDbError, patchVehicle } from "@/lib/hr-db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const { id } = await params;
    const body = await request.json();
    const vehicle = await patchVehicle(organizationId, { ...body, id });
    return NextResponse.json(vehicle);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof HrDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 500 });
  }
}
