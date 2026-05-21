import {
  Prisma,
  ResponsibilityPhase,
  type TrackedAsset,
} from "@prisma/client";

import {
  cdcHolderRoleLabel,
  cdcPhaseTitle,
  CDC_RESPONSIBILITY_CYCLE_REF,
  CDC_RESPONSIBILITY_PHASES,
  CDC_RESPONSIBILITY_PRINCIPLE,
} from "@/lib/cdc-responsibility-cycle";
import { prisma } from "@/lib/prisma";

export type CurrentCustodian = {
  trackedAssetId: string;
  tagCode: string;
  phase: ResponsibilityPhase;
  phaseTitle: string;
  holderRoleLabel: string;
  holderUserId: string;
  holderName: string | null;
  since: string;
  eventId?: string | null;
  eventName?: string | null;
  stockDocumentId?: string | null;
  documentNumber?: string | null;
  signatureValidated: boolean;
};

export function getResponsibilityCycleSpec() {
  return {
    ref: CDC_RESPONSIBILITY_CYCLE_REF,
    principle: CDC_RESPONSIBILITY_PRINCIPLE,
    phases: CDC_RESPONSIBILITY_PHASES.map((p) => ({
      phase: p.phase,
      title: p.title,
      cdcStage: p.cdcStage,
      holderRole: p.holderRole,
      order: p.order,
    })),
  };
}

/** Ferme les gardes ouvertes avant d'ouvrir une nouvelle custody. */
export async function closeOpenCustodyLogs(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    trackedAssetId?: string | null;
    eventId?: string | null;
  },
): Promise<void> {
  const now = new Date();
  const where: Prisma.ResponsibilityLogWhereInput = {
    organizationId: params.organizationId,
    endedAt: null,
  };
  if (params.trackedAssetId) {
    where.trackedAssetId = params.trackedAssetId;
  } else if (params.eventId) {
    where.eventId = params.eventId;
  } else {
    return;
  }
  await tx.responsibilityLog.updateMany({
    where,
    data: { endedAt: now },
  });
}

/** Ouvre une garde documentée (§8.1) et synchronise le détenteur sur l'unité RFID. */
export async function appendCustodyLog(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    eventId?: string | null;
    stockDocumentId: string;
    trackedAssetId?: string | null;
    phase: ResponsibilityPhase;
    holderUserId: string;
  },
): Promise<void> {
  const now = new Date();
  if (params.trackedAssetId) {
    await closeOpenCustodyLogs(tx, {
      organizationId: params.organizationId,
      trackedAssetId: params.trackedAssetId,
    });
  } else if (params.eventId) {
    await closeOpenCustodyLogs(tx, {
      organizationId: params.organizationId,
      eventId: params.eventId,
    });
  }

  await tx.responsibilityLog.create({
    data: {
      organizationId: params.organizationId,
      eventId: params.eventId ?? undefined,
      stockDocumentId: params.stockDocumentId,
      trackedAssetId: params.trackedAssetId ?? undefined,
      phase: params.phase,
      holderUserId: params.holderUserId,
      startedAt: now,
    },
  });

  if (params.trackedAssetId) {
    await tx.trackedAsset.update({
      where: { id: params.trackedAssetId },
      data: { custodianUserId: params.holderUserId },
    });
  }
}

export async function logCustodyForDocumentLines(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    eventId?: string | null;
    stockDocumentId: string;
    phase: ResponsibilityPhase;
    holderUserId: string;
    lines: { trackedAssetId: string | null }[];
  },
): Promise<void> {
  const assetIds = params.lines
    .map((l) => l.trackedAssetId)
    .filter((id): id is string => Boolean(id));
  if (assetIds.length === 0) {
    await appendCustodyLog(tx, {
      organizationId: params.organizationId,
      eventId: params.eventId,
      stockDocumentId: params.stockDocumentId,
      phase: params.phase,
      holderUserId: params.holderUserId,
    });
    return;
  }
  for (const trackedAssetId of assetIds) {
    await appendCustodyLog(tx, {
      organizationId: params.organizationId,
      eventId: params.eventId,
      stockDocumentId: params.stockDocumentId,
      trackedAssetId,
      phase: params.phase,
      holderUserId: params.holderUserId,
    });
  }
}

async function resolveAssetId(
  organizationId: string,
  opts: { trackedAssetId?: string; tagCode?: string },
): Promise<TrackedAsset | null> {
  if (opts.trackedAssetId) {
    return prisma.trackedAsset.findFirst({
      where: { id: opts.trackedAssetId, organizationId },
    });
  }
  const code = opts.tagCode?.trim().toUpperCase();
  if (!code) return null;
  return prisma.trackedAsset.findFirst({
    where: { organizationId, tagCode: code },
  });
}

export async function resolveCurrentCustodian(
  organizationId: string,
  opts: { trackedAssetId?: string; tagCode?: string },
): Promise<CurrentCustodian | null> {
  const asset = await resolveAssetId(organizationId, opts);
  if (!asset) return null;

  const open = await prisma.responsibilityLog.findFirst({
    where: {
      organizationId,
      trackedAssetId: asset.id,
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
    include: {
      holder: { select: { fullName: true } },
      event: { select: { id: true, name: true } },
      stockDocument: { select: { id: true, documentNumber: true, status: true } },
    },
  });

  if (open) {
    return {
      trackedAssetId: asset.id,
      tagCode: asset.tagCode,
      phase: open.phase,
      phaseTitle: cdcPhaseTitle(open.phase),
      holderRoleLabel: cdcHolderRoleLabel(open.phase),
      holderUserId: open.holderUserId,
      holderName: open.holder?.fullName ?? null,
      since: open.startedAt.toISOString(),
      eventId: open.eventId,
      eventName: open.event?.name ?? null,
      stockDocumentId: open.stockDocumentId,
      documentNumber: open.stockDocument?.documentNumber ?? null,
      signatureValidated: true,
    };
  }

  if (asset.custodianUserId) {
    const holder = await prisma.user.findFirst({
      where: { id: asset.custodianUserId, organizationId },
      select: { fullName: true },
    });
    const phase = inferPhaseFromAsset(asset);
    return {
      trackedAssetId: asset.id,
      tagCode: asset.tagCode,
      phase,
      phaseTitle: cdcPhaseTitle(phase),
      holderRoleLabel: cdcHolderRoleLabel(phase),
      holderUserId: asset.custodianUserId,
      holderName: holder?.fullName ?? null,
      since: asset.updatedAt.toISOString(),
      eventId: asset.currentEventId,
      signatureValidated: false,
    };
  }

  return null;
}

function inferPhaseFromAsset(asset: TrackedAsset): ResponsibilityPhase {
  if (asset.currentEventId) {
    return ResponsibilityPhase.SITE;
  }
  return ResponsibilityPhase.STOCK;
}

export async function resolveCustodianAtIncident(
  organizationId: string,
  tagCode: string,
): Promise<CurrentCustodian | null> {
  return resolveCurrentCustodian(organizationId, { tagCode });
}
