import {
  BeSubtype,
  BsSubtype,
  ResponsibilityPhase,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";

import {
  cdcHolderRoleLabel,
  cdcPhaseTitle,
} from "@/lib/cdc-responsibility-cycle";
import { prisma } from "@/lib/prisma";

export type ResponsibilityChainStep = {
  phase: ResponsibilityPhase;
  label: string;
  holderRole: string;
  status: "done" | "active" | "pending";
  documentNumber?: string;
  documentId?: string;
  holderName?: string;
  at?: string;
  signatureValidated?: boolean;
};

export async function buildEventResponsibilityChain(
  organizationId: string,
  eventId: string,
): Promise<{ eventName: string; steps: ResponsibilityChainStep[] }> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    select: {
      name: true,
      orderStatus: true,
      teamLeader: { select: { fullName: true } },
      vehicle: { select: { label: true, plateNumber: true } },
    },
  });
  if (!event) {
    throw new Error("Événement introuvable");
  }

  const docs = await prisma.stockDocument.findMany({
    where: { organizationId, eventId },
    include: {
      signatures: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const logs = await prisma.responsibilityLog.findMany({
    where: { organizationId, eventId },
    orderBy: { startedAt: "asc" },
  });

  const holderIds = [...new Set(logs.map((l) => l.holderUserId))];
  const holders = await prisma.user.findMany({
    where: { id: { in: holderIds }, organizationId },
    select: { id: true, fullName: true },
  });
  const holderNameById = new Map(holders.map((u) => [u.id, u.fullName]));
  const holderName = (userId: string) => holderNameById.get(userId);

  const bsEvt = docs.find(
    (d) => d.kind === StockDocumentKind.BS && d.bsSubtype === BsSubtype.BS_EVT,
  );
  const beRet = docs.find(
    (d) => d.kind === StockDocumentKind.BE && d.beSubtype === BeSubtype.BE_RET,
  );

  const latestLogByPhase = new Map<ResponsibilityPhase, (typeof logs)[number]>();
  for (const log of logs) {
    if (!log.endedAt) {
      latestLogByPhase.set(log.phase, log);
    }
  }

  const steps: ResponsibilityChainStep[] = [];

  const stockDone = Boolean(bsEvt && bsEvt.signatures.length >= 1);
  const stockLog = latestLogByPhase.get(ResponsibilityPhase.STOCK);
  steps.push({
    phase: ResponsibilityPhase.STOCK,
    label: cdcPhaseTitle(ResponsibilityPhase.STOCK),
    holderRole: cdcHolderRoleLabel(ResponsibilityPhase.STOCK),
    status: stockDone ? "done" : bsEvt ? "active" : "pending",
    documentNumber: bsEvt?.documentNumber,
    documentId: bsEvt?.id,
    holderName:
      (stockLog ? holderName(stockLog.holderUserId) : undefined) ??
      bsEvt?.signatures[0]?.user.fullName,
    at: bsEvt?.signatures[0] ? bsEvt.createdAt.toISOString() : undefined,
    signatureValidated: stockDone,
  });

  const transportDone = Boolean(bsEvt && bsEvt.signatures.length >= 2);
  const transportLog = latestLogByPhase.get(ResponsibilityPhase.TRANSPORT);
  steps.push({
    phase: ResponsibilityPhase.TRANSPORT,
    label: cdcPhaseTitle(ResponsibilityPhase.TRANSPORT),
    holderRole: cdcHolderRoleLabel(ResponsibilityPhase.TRANSPORT),
    status: transportDone ? "done" : stockDone ? "active" : "pending",
    documentNumber: bsEvt?.documentNumber,
    holderName:
      (transportLog ? holderName(transportLog.holderUserId) : undefined) ??
      (event.vehicle
        ? `${event.vehicle.label} (${event.vehicle.plateNumber})`
        : bsEvt?.signatures[1]?.user.fullName),
    signatureValidated: transportDone,
  });

  const siteActive =
    event.orderStatus === "IN_PROGRESS" || event.orderStatus === "SETTLED";
  const siteLog = latestLogByPhase.get(ResponsibilityPhase.SITE);
  const siteDone = Boolean(bsEvt?.status === StockDocumentStatus.SIGNED && siteActive);
  steps.push({
    phase: ResponsibilityPhase.SITE,
    label: cdcPhaseTitle(ResponsibilityPhase.SITE),
    holderRole: cdcHolderRoleLabel(ResponsibilityPhase.SITE),
    status: siteDone ? (beRet ? "done" : "active") : transportDone ? "active" : "pending",
    holderName:
      (siteLog ? holderName(siteLog.holderUserId) : undefined) ?? event.teamLeader?.fullName,
    at: bsEvt?.signedAt?.toISOString(),
    signatureValidated: Boolean(bsEvt?.status === StockDocumentStatus.SIGNED),
  });

  const demountLog = latestLogByPhase.get(ResponsibilityPhase.DEMOUNT);
  steps.push({
    phase: ResponsibilityPhase.DEMOUNT,
    label: cdcPhaseTitle(ResponsibilityPhase.DEMOUNT),
    holderRole: cdcHolderRoleLabel(ResponsibilityPhase.DEMOUNT),
    status: demountLog || (beRet && beRet.signatures.length >= 2)
      ? "done"
      : siteActive
        ? "active"
        : "pending",
    documentNumber: beRet?.documentNumber,
    documentId: beRet?.id,
    holderName:
      (demountLog ? holderName(demountLog.holderUserId) : undefined) ??
      beRet?.signatures[1]?.user.fullName,
    signatureValidated: Boolean(demountLog || (beRet && beRet.signatures.length >= 2)),
  });

  const returnDone = Boolean(beRet && beRet.status === StockDocumentStatus.SIGNED);
  const returnLog = latestLogByPhase.get(ResponsibilityPhase.RETURN_STOCK);
  steps.push({
    phase: ResponsibilityPhase.RETURN_STOCK,
    label: cdcPhaseTitle(ResponsibilityPhase.RETURN_STOCK),
    holderRole: cdcHolderRoleLabel(ResponsibilityPhase.RETURN_STOCK),
    status: returnDone ? "done" : beRet ? "active" : "pending",
    documentNumber: beRet?.documentNumber,
    documentId: beRet?.id,
    holderName:
      (returnLog ? holderName(returnLog.holderUserId) : undefined) ??
      beRet?.signatures[0]?.user.fullName,
    at: beRet?.signedAt?.toISOString(),
    signatureValidated: returnDone,
  });

  if (logs.length > 0) {
    const open = logs.filter((l) => !l.endedAt).pop();
    if (open) {
      const idx = steps.findIndex((s) => s.phase === open.phase);
      if (idx >= 0 && steps[idx].status === "pending") {
        steps[idx].status = "active";
        steps[idx].holderName = holderName(open.holderUserId) ?? steps[idx].holderName;
      }
    }
  }

  return { eventName: event.name, steps };
}
