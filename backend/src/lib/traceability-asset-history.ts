import { ResponsibilityPhase } from "@prisma/client";

import { cdcHolderRoleLabel, cdcPhaseTitle } from "@/lib/cdc-responsibility-cycle";
import { prisma } from "@/lib/prisma";
import { resolveCurrentCustodian, type CurrentCustodian } from "@/lib/responsibility-db";

export type AssetMovementRow = {
  at: string;
  documentId: string;
  documentNumber: string;
  kind: string;
  status: string;
  expectedQty: number;
  scannedQty: number;
  receivedQty: number | null;
  eventId: string | null;
  eventName: string | null;
};

export type AssetCustodyRow = {
  id: string;
  phase: ResponsibilityPhase;
  phaseTitle: string;
  holderRole: string;
  holderName: string | null;
  startedAt: string;
  endedAt: string | null;
  eventId: string | null;
  eventName: string | null;
  documentNumber: string | null;
};

export type AssetEventRow = {
  id: string;
  name: string;
  clientName: string;
  location: string;
  orderStatus: string;
  firstAt: string;
  lastAt: string;
  documentCount: number;
};

export type AssetFullHistory = {
  asset: {
    id: string;
    tagCode: string;
    status: string;
    item: { name: string; reference: string; emoji: string | null };
    currentWarehouse: { code: string; name: string } | null;
  };
  currentCustodian: CurrentCustodian | null;
  movements: AssetMovementRow[];
  custodyChain: AssetCustodyRow[];
  events: AssetEventRow[];
};

export async function getAssetFullHistory(
  organizationId: string,
  trackedAssetId: string,
): Promise<AssetFullHistory | null> {
  const asset = await prisma.trackedAsset.findFirst({
    where: { id: trackedAssetId, organizationId },
    include: {
      item: { select: { name: true, reference: true, emoji: true } },
      currentWarehouse: { select: { code: true, name: true } },
    },
  });
  if (!asset) return null;

  const [lines, logs, currentCustodian] = await Promise.all([
    prisma.documentLine.findMany({
      where: { trackedAssetId },
      include: {
        stockDocument: {
          select: {
            id: true,
            documentNumber: true,
            kind: true,
            status: true,
            signedAt: true,
            createdAt: true,
            eventId: true,
            event: { select: { name: true } },
          },
        },
      },
      orderBy: { stockDocument: { createdAt: "desc" } },
      take: 80,
    }),
    prisma.responsibilityLog.findMany({
      where: { trackedAssetId, organizationId },
      include: {
        event: { select: { id: true, name: true, clientName: true, location: true, orderStatus: true } },
        stockDocument: { select: { documentNumber: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 60,
    }),
    resolveCurrentCustodian(organizationId, { trackedAssetId }),
  ]);

  const holderIds = [...new Set(logs.map((l) => l.holderUserId))];
  const holders = await prisma.user.findMany({
    where: { id: { in: holderIds }, organizationId },
    select: { id: true, fullName: true },
  });
  const holderNames = new Map(holders.map((u) => [u.id, u.fullName]));

  const movements: AssetMovementRow[] = lines
    .map((line) => {
      const doc = line.stockDocument;
      return {
        at: (doc.signedAt ?? doc.createdAt).toISOString(),
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        kind: doc.kind,
        status: doc.status,
        expectedQty: line.expectedQty,
        scannedQty: line.scannedQty,
        receivedQty: line.receivedQty,
        eventId: doc.eventId,
        eventName: doc.event?.name ?? null,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const custodyChain: AssetCustodyRow[] = logs.map((log) => ({
    id: log.id,
    phase: log.phase,
    phaseTitle: cdcPhaseTitle(log.phase),
    holderRole: cdcHolderRoleLabel(log.phase),
    holderName: holderNames.get(log.holderUserId) ?? null,
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt?.toISOString() ?? null,
    eventId: log.eventId,
    eventName: log.event?.name ?? null,
    documentNumber: log.stockDocument?.documentNumber ?? null,
  }));

  const eventMap = new Map<string, AssetEventRow>();
  for (const log of logs) {
    if (!log.event) continue;
    const at = log.startedAt.toISOString();
    const existing = eventMap.get(log.event.id);
    if (!existing) {
      eventMap.set(log.event.id, {
        id: log.event.id,
        name: log.event.name,
        clientName: log.event.clientName,
        location: log.event.location,
        orderStatus: log.event.orderStatus,
        firstAt: at,
        lastAt: at,
        documentCount: 0,
      });
    } else {
      if (at < existing.firstAt) existing.firstAt = at;
      if (at > existing.lastAt) existing.lastAt = at;
    }
  }
  const movementEventIds = [
    ...new Set(movements.map((m) => m.eventId).filter((id): id is string => Boolean(id))),
  ].filter((id) => !eventMap.has(id));
  if (movementEventIds.length > 0) {
    const extraEvents = await prisma.event.findMany({
      where: { id: { in: movementEventIds }, organizationId },
      select: {
        id: true,
        name: true,
        clientName: true,
        location: true,
        orderStatus: true,
      },
    });
    for (const ev of extraEvents) {
      eventMap.set(ev.id, {
        id: ev.id,
        name: ev.name,
        clientName: ev.clientName,
        location: ev.location,
        orderStatus: ev.orderStatus,
        firstAt: movements.find((m) => m.eventId === ev.id)?.at ?? new Date().toISOString(),
        lastAt: movements.find((m) => m.eventId === ev.id)?.at ?? new Date().toISOString(),
        documentCount: movements.filter((m) => m.eventId === ev.id).length,
      });
    }
  }
  for (const m of movements) {
    if (!m.eventId) continue;
    const existing = eventMap.get(m.eventId);
    if (!existing) continue;
    existing.documentCount = movements.filter((x) => x.eventId === m.eventId).length;
    if (m.at < existing.firstAt) existing.firstAt = m.at;
    if (m.at > existing.lastAt) existing.lastAt = m.at;
  }

  const events = [...eventMap.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return {
    asset: {
      id: asset.id,
      tagCode: asset.tagCode,
      status: asset.status,
      item: asset.item,
      currentWarehouse: asset.currentWarehouse,
    },
    currentCustodian,
    movements,
    custodyChain,
    events,
  };
}
