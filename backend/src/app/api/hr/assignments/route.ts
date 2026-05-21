import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import { assignToProject, HrDbError, listProjectAssignments } from "@/lib/hr-db";

export async function GET(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    return NextResponse.json(await listProjectAssignments(organizationId, eventId));
  } catch {
    return NextResponse.json({ message: "Impossible de charger les affectations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const body = await request.json();
    const row = await assignToProject(organizationId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof HrDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Affectation impossible" }, { status: 500 });
  }
}
