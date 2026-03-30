import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { SEED_IDS, seedDemoData } from "@/lib/seed-test-data";

const ORGANIZATION_ID = SEED_IDS.organization;
const ADMIN_ID = SEED_IDS.userAdmin;

const bodySchema = z
  .object({
    /** Si true (défaut) : organisation + utilisateurs + catégories + articles + événements + affectations + 2 mouvements. */
    demo: z.boolean().optional(),
  })
  .optional();

export async function POST(request: Request) {
  try {
    let demo = true;
    try {
      const json = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (parsed.success && parsed.data?.demo === false) {
        demo = false;
      }
    } catch {
      // corps vide → demo par défaut
    }

    const organization = await prisma.organization.upsert({
      where: { id: ORGANIZATION_ID },
      update: {},
      create: {
        id: ORGANIZATION_ID,
        name: "StockEvent Demo",
      },
    });

    const seedPw = process.env.SEED_DEMO_PASSWORD ?? "Demo1234!";
    const passwordHash = await bcrypt.hash(seedPw, 10);

    const admin = await prisma.user.upsert({
      where: { id: ADMIN_ID },
      update: {
        username: "admin",
        passwordHash,
      },
      create: {
        id: ADMIN_ID,
        username: "admin",
        email: "admin@stockevent.local",
        fullName: "Admin StockEvent",
        role: Role.ADMIN,
        organizationId: organization.id,
        passwordHash,
      },
    });

    if (!demo) {
      return NextResponse.json({
        ok: true,
        mode: "minimal",
        organization,
        admin,
        headers: {
          "x-organization-id": ORGANIZATION_ID,
          "x-actor-id": ADMIN_ID,
        },
      });
    }

    const { counts } = await seedDemoData(prisma);

    return NextResponse.json({
      ok: true,
      mode: "demo",
      organization,
      admin,
      counts,
      headers: {
        "x-organization-id": ORGANIZATION_ID,
        "x-actor-id": ADMIN_ID,
      },
    });
  } catch (e) {
    console.error("[seed]", e);
    return NextResponse.json(
      { message: "Erreur pendant le seed (voir les logs serveur)." },
      { status: 500 }
    );
  }
}
