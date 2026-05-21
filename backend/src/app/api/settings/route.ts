import { NextResponse } from "next/server";
import { z } from "zod";

import { getDirectingPrinciplePublic } from "@/lib/cdc-directing-principle";
import {
  assertOrgSettingsAdmin,
  getOrganizationSettingsBundle,
  OrganizationSettingsError,
  updateOrganizationSettings,
} from "@/lib/organization-settings-db";
import { organizationSettingsSchema } from "@/lib/organization-settings";
import { getRequestContext } from "@/lib/request-context";
import { getApiOriginForDisplay } from "@/lib/stock/api";

const patchSchema = z.object({
  organizationName: z.string().min(2).max(120).optional(),
  settings: organizationSettingsSchema.partial().optional(),
});

export async function GET() {
  try {
    const { organizationId, actorId, role } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    const bundle = await getOrganizationSettingsBundle(organizationId);
    return NextResponse.json({
      ...bundle,
      actor: { role },
      system: {
        apiOrigin: getApiOriginForDisplay(),
        directingPrinciple: getDirectingPrinciplePublic(),
      },
    });
  } catch (error) {
    if (error instanceof OrganizationSettingsError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Impossible de charger les paramètres" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, actorId, role } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Session requise" }, { status: 401 });
    }
    assertOrgSettingsAdmin(role);
    const body = patchSchema.parse(await request.json());
    const organization = await updateOrganizationSettings(organizationId, {
      name: body.organizationName,
      settings: body.settings,
    });
    return NextResponse.json({ organization });
  } catch (error) {
    if (error instanceof OrganizationSettingsError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide", errors: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 500 });
  }
}
