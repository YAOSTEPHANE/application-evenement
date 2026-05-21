
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
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
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Archives indisponibles" }, { status: 500 });
  }
}
