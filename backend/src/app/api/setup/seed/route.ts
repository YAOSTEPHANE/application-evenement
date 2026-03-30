import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const ORGANIZATION_ID = "000000000000000000000001";
const ADMIN_ID = "000000000000000000000002";

export async function POST() {
  try {
    const organization = await prisma.organization.upsert({
      where: { id: ORGANIZATION_ID },
      update: {},
      create: {
        id: ORGANIZATION_ID,
        name: "StockEvent Demo",
      },
    });

    const admin = await prisma.user.upsert({
      where: { id: ADMIN_ID },
      update: {},
      create: {
        id: ADMIN_ID,
        email: "admin@stockevent.local",
        fullName: "Admin StockEvent",
        role: Role.ADMIN,
        organizationId: organization.id,
      },
    });

    return NextResponse.json({
      ok: true,
      organization,
      admin,
      headers: {
        "x-organization-id": ORGANIZATION_ID,
        "x-actor-id": ADMIN_ID,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Erreur pendant le seed initial" },
      { status: 500 }
    );
  }
}
