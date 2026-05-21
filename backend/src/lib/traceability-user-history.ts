import { ResponsibilityPhase } from "@prisma/client";

import { cdcPhaseTitle } from "@/lib/cdc-responsibility-cycle";
import { prisma } from "@/lib/prisma";

export type UserSignatureRow = {
  id: string;
  signedAt: string;
  roleAtSign: string;
  documentId: string;
  documentNumber: string;
  documentKind: string;
  documentStatus: string;
  eventId: string | null;
  eventName: string | null;
};

export type UserCustodyRow = {
  id: string;
  phase: ResponsibilityPhase;
  phaseTitle: string;
  startedAt: string;
  endedAt: string | null;
  eventName: string | null;
  documentNumber: string | null;
  tagCode: string | null;
  itemName: string | null;
};

export type UserFullHistory = {
  user: {
    id: string;
    fullName: string;
    role: string;
    email: string;
  };
  signatures: UserSignatureRow[];
  custodies: UserCustodyRow[];
  stats: {
    signaturesCount: number;
    openCustodies: number;
    eventsTouched: number;
  };
};

export async function getUserFullHistory(
  organizationId: string,
  userId: string,
): Promise<UserFullHistory | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true, fullName: true, role: true, email: true },
  });
  if (!user) return null;

  const [signatures, custodies] = await Promise.all([
    prisma.documentSignature.findMany({
      where: { userId, stockDocument: { organizationId } },
      include: {
        stockDocument: {
          select: {
            id: true,
            documentNumber: true,
            kind: true,
            status: true,
            eventId: true,
            event: { select: { name: true } },
          },
        },
      },
      orderBy: { signedAt: "desc" },
      take: 80,
    }),
    prisma.responsibilityLog.findMany({
      where: { organizationId, holderUserId: userId },
      include: {
        event: { select: { name: true } },
        stockDocument: { select: { documentNumber: true } },
        trackedAsset: {
          select: {
            tagCode: true,
            item: { select: { name: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 80,
    }),
  ]);

  const signatureRows: UserSignatureRow[] = signatures.map((s) => ({
    id: s.id,
    signedAt: s.signedAt.toISOString(),
    roleAtSign: s.roleAtSign,
    documentId: s.stockDocument.id,
    documentNumber: s.stockDocument.documentNumber,
    documentKind: s.stockDocument.kind,
    documentStatus: s.stockDocument.status,
    eventId: s.stockDocument.eventId,
    eventName: s.stockDocument.event?.name ?? null,
  }));

  const custodyRows: UserCustodyRow[] = custodies.map((c) => ({
    id: c.id,
    phase: c.phase,
    phaseTitle: cdcPhaseTitle(c.phase),
    startedAt: c.startedAt.toISOString(),
    endedAt: c.endedAt?.toISOString() ?? null,
    eventName: c.event?.name ?? null,
    documentNumber: c.stockDocument?.documentNumber ?? null,
    tagCode: c.trackedAsset?.tagCode ?? null,
    itemName: c.trackedAsset?.item.name ?? null,
  }));

  const eventIds = new Set<string>();
  for (const s of signatureRows) {
    if (s.eventId) eventIds.add(s.eventId);
  }

  return {
    user,
    signatures: signatureRows,
    custodies: custodyRows,
    stats: {
      signaturesCount: signatureRows.length,
      openCustodies: custodyRows.filter((c) => !c.endedAt).length,
      eventsTouched: eventIds.size,
    },
  };
}

export async function listTraceabilityUsers(organizationId: string, q?: string) {
  const query = q?.trim();
  return prisma.user.findMany({
    where: {
      organizationId,
      active: true,
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, fullName: true, role: true, email: true },
    orderBy: { fullName: "asc" },
    take: 40,
  });
}
