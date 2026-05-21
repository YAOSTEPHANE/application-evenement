import {
  BeSubtype,
  BsSubtype,
  BtTransitPhase,
  StockDocumentKind,
  StockDocumentStatus,
  type Role,
} from "@prisma/client";

import { roleRequires2Fa } from "@/lib/cdc-labels";
import {
  signSlotsForDocument,
  totalSignaturesRequired,
  type SignSlot,
} from "@/lib/cdc-validation-matrix";
import { prisma } from "@/lib/prisma";

export type ValidationStats = {
  pendingSignature: number;
  scanning: number;
  disputed: number;
  archivesTotal: number;
  signedToday: number;
  users2faGap: number;
};

export type PendingValidationDoc = {
  id: string;
  documentNumber: string;
  kind: StockDocumentKind;
  status: StockDocumentStatus;
  signaturesDone: number;
  signaturesRequired: number;
  nextSignLabel: string | null;
  eventName: string | null;
  updatedAt: string;
};

export type ValidationArchiveRow = {
  id: string;
  documentNumber: string;
  kind: StockDocumentKind;
  retentionUntil: string;
  signedAt: string | null;
  contentHash: string;
};

export type ValidationSecurityRow = {
  role: Role;
  requires2Fa: boolean;
  activeUsers: number;
  missing2fa: number;
};

export type ValidationOverview = {
  stats: ValidationStats;
  pending: PendingValidationDoc[];
  archives: ValidationArchiveRow[];
  security: ValidationSecurityRow[];
};

function nextSignSlot(
  kind: StockDocumentKind,
  signatureCount: number,
  opts: {
    bsSubtype?: BsSubtype | null;
    beSubtype?: BeSubtype | null;
    btTransitPhase?: BtTransitPhase | null;
  },
): SignSlot | null {
  const slots = signSlotsForDocument(kind, opts);
  return slots[signatureCount] ?? null;
}

export async function getValidationOverview(organizationId: string): Promise<ValidationOverview> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    pendingSignature,
    scanning,
    disputed,
    archivesTotal,
    signedToday,
    openDocs,
    archives,
    users,
  ] = await Promise.all([
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.PENDING_SIGNATURE },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.SCANNING },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.DISPUTED },
    }),
    prisma.documentArchive.count({ where: { organizationId } }),
    prisma.stockDocument.count({
      where: {
        organizationId,
        status: StockDocumentStatus.SIGNED,
        signedAt: { gte: todayStart },
      },
    }),
    prisma.stockDocument.findMany({
      where: {
        organizationId,
        status: {
          in: [
            StockDocumentStatus.PENDING_SIGNATURE,
            StockDocumentStatus.SCANNING,
            StockDocumentStatus.DISPUTED,
          ],
        },
      },
      include: {
        signatures: true,
        event: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.documentArchive.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        contentHash: true,
        retentionUntil: true,
        stockDocument: {
          select: {
            documentNumber: true,
            kind: true,
            signedAt: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { organizationId, active: true },
      select: { role: true, twoFactorEnabled: true },
    }),
  ]);

  const pending: PendingValidationDoc[] = openDocs.map((doc) => {
    const signaturesDone = doc.signatures.length;
    const signaturesRequired = totalSignaturesRequired(doc.kind, {
      beSubtype: doc.beSubtype,
      bsSubtype: doc.bsSubtype,
    });
    const next = nextSignSlot(doc.kind, signaturesDone, {
      bsSubtype: doc.bsSubtype,
      beSubtype: doc.beSubtype,
      btTransitPhase: doc.btTransitPhase,
    });
    return {
      id: doc.id,
      documentNumber: doc.documentNumber,
      kind: doc.kind,
      status: doc.status,
      signaturesDone,
      signaturesRequired,
      nextSignLabel: next?.label ?? null,
      eventName: doc.event?.name ?? null,
      updatedAt: doc.updatedAt.toISOString(),
    };
  });

  const securityMap = new Map<Role, ValidationSecurityRow>();
  for (const u of users) {
    const row = securityMap.get(u.role) ?? {
      role: u.role,
      requires2Fa: roleRequires2Fa(u.role),
      activeUsers: 0,
      missing2fa: 0,
    };
    row.activeUsers += 1;
    if (roleRequires2Fa(u.role) && !u.twoFactorEnabled) {
      row.missing2fa += 1;
    }
    securityMap.set(u.role, row);
  }

  const users2faGap = users.filter(
    (u) => roleRequires2Fa(u.role) && !u.twoFactorEnabled,
  ).length;

  return {
    stats: {
      pendingSignature,
      scanning,
      disputed,
      archivesTotal,
      signedToday,
      users2faGap,
    },
    pending,
    archives: archives.map((a) => ({
      id: a.id,
      documentNumber: a.stockDocument.documentNumber,
      kind: a.stockDocument.kind,
      retentionUntil: a.retentionUntil.toISOString(),
      signedAt: a.stockDocument.signedAt?.toISOString() ?? null,
      contentHash: a.contentHash.slice(0, 12),
    })),
    security: [...securityMap.values()].sort((a, b) => a.role.localeCompare(b.role)),
  };
}
