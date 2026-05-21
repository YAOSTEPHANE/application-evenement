import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    const rows = await prisma.documentArchive.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        stockDocumentId: true,
        contentHash: true,
        retentionUntil: true,
        createdAt: true,
        stockDocument: {
          select: {
            documentNumber: true,
            kind: true,
            signedAt: true,
          },
        },
      },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ message: "Archives indisponibles" }, { status: 500 });
  }
}
