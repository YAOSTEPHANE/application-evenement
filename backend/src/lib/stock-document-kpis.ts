import { StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const OPEN_STATUSES: StockDocumentStatus[] = [
  StockDocumentStatus.DRAFT,
  StockDocumentStatus.SCANNING,
  StockDocumentStatus.PENDING_SIGNATURE,
];

export type StockDocumentsKpis = {
  open: number;
  disputed: number;
  signed: number;
  scanning: number;
  byKind: { BE: number; BS: number; BT: number };
  scansToday: number;
  pendingSignatures: number;
};

export async function getStockDocumentsKpis(organizationId: string): Promise<StockDocumentsKpis> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    open,
    disputed,
    signed,
    scanning,
    beOpen,
    bsOpen,
    btOpen,
    scansToday,
    pendingSignatures,
  ] = await Promise.all([
    prisma.stockDocument.count({
      where: { organizationId, status: { in: OPEN_STATUSES } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.DISPUTED },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.SIGNED },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.SCANNING },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BE, status: { in: OPEN_STATUSES } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BS, status: { in: OPEN_STATUSES } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, kind: StockDocumentKind.BT, status: { in: OPEN_STATUSES } },
    }),
    prisma.rfidScanBatch.count({
      where: { scannedAt: { gte: startOfDay }, stockDocument: { organizationId } },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.PENDING_SIGNATURE },
    }),
  ]);

  return {
    open,
    disputed,
    signed,
    scanning,
    byKind: { BE: beOpen, BS: bsOpen, BT: btOpen },
    scansToday,
    pendingSignatures,
  };
}
