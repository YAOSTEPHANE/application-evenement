import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const querySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
  skip: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

/**
 * Journal des actions enregistrées (mouvements de stock, etc.).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      take: searchParams.get("take") ?? undefined,
      skip: searchParams.get("skip") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Paramètres invalides", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { take, skip } = parsed.data;
    const { organizationId } = await getRequestContext();

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where: { organizationId } }),
    ]);

    return NextResponse.json({
      total,
      take,
      skip,
      logs,
    });
  } catch {
    return NextResponse.json({ message: "Impossible de charger le journal" }, { status: 500 });
  }
}
