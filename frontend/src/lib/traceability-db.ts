import {
  BeSubtype,
  BsSubtype,
  OrderStatus,
  ResponsibilityPhase,
  StockDocumentKind,
  StockDocumentStatus,
  TrackedAssetStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildEventResponsibilityChain, type ResponsibilityChainStep } from "@/lib/responsibility-chain";

const PHASE_LABELS: Record<ResponsibilityPhase, string> = {
  STOCK: "Stock",
  TRANSPORT: "Transport",
  SITE: "Site",
  DEMOUNT: "Démontage",
  RETURN_STOCK: "Retour stock",
};

export type TraceabilityStats = {
  traceabilityPct: number;
  taggedUnits: number;
  catalogQty: number;
  eventsActive: number;
  openCustody: number;
  disputedDocs: number;
  quarantineUnits: number;
  onSiteUnits: number;
  inTransitUnits: number;
};

export type EventTraceRow = {
  id: string;
  name: string;
  clientName: string;
  location: string;
  orderStatus: OrderStatus;
  startsAt: string;
  endsAt: string;
  teamLeaderName: string | null;
  vehicleLabel: string | null;
  progressPct: number;
  currentPhase: string | null;
  bsNumber: string | null;
  beRetNumber: string | null;
};

export type CustodyLogRow = {
  id: string;
  phase: ResponsibilityPhase;
  phaseLabel: string;
  startedAt: string;
  endedAt: string | null;
  holderName: string;
  eventName: string | null;
  documentNumber: string | null;
  tagCode: string | null;
  itemName: string | null;
};

export async function getTraceabilityStats(organizationId: string): Promise<TraceabilityStats> {
  const [
    taggedUnits,
    catalogAgg,
    eventsActive,
    openCustody,
    disputedDocs,
    quarantineUnits,
    onSiteUnits,
    inTransitUnits,
  ] = await Promise.all([
    prisma.trackedAsset.count({
      where: { organizationId, status: { not: TrackedAssetStatus.SCRAPPED } },
    }),
    prisma.item.aggregate({
      where: { organizationId },
      _sum: { totalQuantity: true },
    }),
    prisma.event.count({
      where: {
        organizationId,
        orderStatus: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
      },
    }),
    prisma.responsibilityLog.count({
      where: { organizationId, endedAt: null },
    }),
    prisma.stockDocument.count({
      where: { organizationId, status: StockDocumentStatus.DISPUTED },
    }),
    prisma.trackedAsset.count({
      where: { organizationId, status: TrackedAssetStatus.QUARANTINE },
    }),
    prisma.trackedAsset.count({
      where: { organizationId, status: TrackedAssetStatus.ON_SITE },
    }),
    prisma.trackedAsset.count({
      where: { organizationId, status: TrackedAssetStatus.IN_TRANSIT },
    }),
  ]);

  const catalogQty = catalogAgg._sum.totalQuantity ?? 0;
  const traceabilityPct =
    catalogQty > 0 ? Math.min(100, Math.round((taggedUnits / catalogQty) * 1000) / 10) : 0;

  return {
    traceabilityPct,
    taggedUnits,
    catalogQty,
    eventsActive,
    openCustody,
    disputedDocs,
    quarantineUnits,
    onSiteUnits,
    inTransitUnits,
  };
}

function computeProgress(
  orderStatus: OrderStatus,
  bsSigned: boolean,
  beRetExists: boolean,
  beRetSigned: boolean,
): { pct: number; currentPhase: string | null } {
  if (orderStatus === OrderStatus.SETTLED) {
    return { pct: 100, currentPhase: null };
  }
  if (beRetSigned) {
    return { pct: 92, currentPhase: "Retour stock" };
  }
  if (beRetExists) {
    return { pct: 78, currentPhase: "BE-RET — scan / signature" };
  }
  if (orderStatus === OrderStatus.IN_PROGRESS) {
    return { pct: 58, currentPhase: "Prestation sur site" };
  }
  if (bsSigned) {
    return { pct: 38, currentPhase: "Transport / chargement validé" };
  }
  return { pct: 12, currentPhase: "BS-EVT — chargement" };
}

export async function listEventTraceability(
  organizationId: string,
  opts?: { activeOnly?: boolean },
): Promise<EventTraceRow[]> {
  const events = await prisma.event.findMany({
    where: {
      organizationId,
      ...(opts?.activeOnly
        ? { orderStatus: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      location: true,
      orderStatus: true,
      startsAt: true,
      endsAt: true,
      teamLeader: { select: { fullName: true } },
      vehicle: { select: { label: true, plateNumber: true } },
    },
    orderBy: [{ orderStatus: "asc" }, { startsAt: "desc" }],
    take: 200,
  });

  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const docs = await prisma.stockDocument.findMany({
    where: { organizationId, eventId: { in: eventIds } },
    select: {
      eventId: true,
      kind: true,
      bsSubtype: true,
      beSubtype: true,
      status: true,
      documentNumber: true,
    },
  });

  return events.map((ev) => {
    const evDocs = docs.filter((d) => d.eventId === ev.id);
    const bsEvt = evDocs.find(
      (d) => d.kind === StockDocumentKind.BS && d.bsSubtype === BsSubtype.BS_EVT,
    );
    const beRet = evDocs.find(
      (d) => d.kind === StockDocumentKind.BE && d.beSubtype === BeSubtype.BE_RET,
    );
    const bsSigned = bsEvt?.status === StockDocumentStatus.SIGNED;
    const beRetSigned = beRet?.status === StockDocumentStatus.SIGNED;
    const { pct, currentPhase } = computeProgress(
      ev.orderStatus,
      Boolean(bsSigned),
      Boolean(beRet),
      Boolean(beRetSigned),
    );

    return {
      id: ev.id,
      name: ev.name,
      clientName: ev.clientName,
      location: ev.location,
      orderStatus: ev.orderStatus,
      startsAt: ev.startsAt.toISOString(),
      endsAt: ev.endsAt.toISOString(),
      teamLeaderName: ev.teamLeader?.fullName ?? null,
      vehicleLabel: ev.vehicle ? `${ev.vehicle.label} (${ev.vehicle.plateNumber})` : null,
      progressPct: pct,
      currentPhase,
      bsNumber: bsEvt?.documentNumber ?? null,
      beRetNumber: beRet?.documentNumber ?? null,
    };
  });
}

export async function getEventChain(
  organizationId: string,
  eventId: string,
): Promise<{ eventName: string; steps: ResponsibilityChainStep[] }> {
  return buildEventResponsibilityChain(organizationId, eventId);
}

export async function listRecentCustodyLogs(
  organizationId: string,
  limit = 40,
): Promise<CustodyLogRow[]> {
  const logs = await prisma.responsibilityLog.findMany({
    where: { organizationId },
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
    take: limit,
  });

  const holderIds = [...new Set(logs.map((l) => l.holderUserId))];
  const holders = await prisma.user.findMany({
    where: { id: { in: holderIds }, organizationId },
    select: { id: true, fullName: true },
  });
  const holderMap = new Map(holders.map((u) => [u.id, u.fullName]));

  return logs.map((log) => ({
    id: log.id,
    phase: log.phase,
    phaseLabel: PHASE_LABELS[log.phase],
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt?.toISOString() ?? null,
    holderName: holderMap.get(log.holderUserId) ?? "—",
    eventName: log.event?.name ?? null,
    documentNumber: log.stockDocument?.documentNumber ?? null,
    tagCode: log.trackedAsset?.tagCode ?? null,
    itemName: log.trackedAsset?.item.name ?? null,
  }));
}
