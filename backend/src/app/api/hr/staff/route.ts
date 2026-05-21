
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";


import {
  assertHrStaffAdmin,
  createStaffMember,
  HrDbError,
  isLinkStaffPayload,
  listStaffProfiles,
  upsertStaffProfile,
} from "@/lib/hr-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    return NextResponse.json(await listStaffProfiles(organizationId));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Impossible de charger le personnel" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, actorId, role } = await requireAuthenticatedContext();
    assertHrStaffAdmin(role, actorId);
    const body = await request.json();
    const profile = isLinkStaffPayload(body)
      ? await upsertStaffProfile(organizationId, body)
      : await createStaffMember(organizationId, body);
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    if (error instanceof HrDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Enregistrement impossible" }, { status: 500 });
  }
}
