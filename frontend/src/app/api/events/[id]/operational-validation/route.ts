
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { OperationalTrioPillar } from "@/lib/cdc-order-trio";
import { EventOrderDbError, recordOperationalTrioValidation } from "@/lib/event-order-db";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";

const bodySchema = z.object({
  pillar: z.enum(["stock", "technical", "fleet"]),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId, actorId, role } = await requireAuthenticatedContext();
    if (!actorId || !role) {
      return NextResponse.json({ message: "Authentification requise" }, { status: 401 });
    }
    const body = bodySchema.parse(await request.json());
    const result = await recordOperationalTrioValidation(
      organizationId,
      id,
      body.pillar as OperationalTrioPillar,
      actorId,
      role,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof EventOrderDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Pilier invalide (stock, technical, fleet)" }, { status: 400 });
    }
    return NextResponse.json({ message: "Validation impossible" }, { status: 500 });
  }
}
