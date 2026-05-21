import {
  BeSubtype,
  BsSubtype,
  OrderStatus,
  ResponsibilityPhase,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";

import { CDC_RESPONSIBILITY_PHASES } from "@/lib/cdc-responsibility-cycle";
import { totalSignaturesRequired } from "@/lib/cdc-validation-matrix";
import { prisma } from "@/lib/prisma";
import {
  buildEventResponsibilityChain,
  type ResponsibilityChainStep,
} from "@/lib/responsibility-chain";

export type ChainAnomalyCode =
  | "SKIPPED_STEP"
  | "MISSING_SIGNATURE"
  | "MISSING_DOCUMENT"
  | "UNSIGNED_STEP"
  | "ASSET_PHASE_SKIP";

export type ChainAnomaly = {
  code: ChainAnomalyCode;
  severity: "warning" | "critical";
  message: string;
  phase?: ResponsibilityPhase;
  documentNumber?: string;
  documentId?: string;
  tagCode?: string;
};

const PHASE_ORDER = new Map(
  CDC_RESPONSIBILITY_PHASES.map((p) => [p.phase, p.order]),
);

function detectStepGaps(steps: ResponsibilityChainStep[]): ChainAnomaly[] {
  const out: ChainAnomaly[] = [];
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const cur = steps[i];
    if (cur.status === "done" && prev.status === "pending") {
      out.push({
        code: "SKIPPED_STEP",
        severity: "critical",
        message: `Étape « ${cur.label} » validée sans « ${prev.label} » complété.`,
        phase: cur.phase,
        documentNumber: cur.documentNumber,
        documentId: cur.documentId,
      });
    }
    if (
      (cur.status === "done" || cur.status === "active") &&
      cur.documentNumber &&
      cur.signatureValidated === false
    ) {
      out.push({
        code: "UNSIGNED_STEP",
        severity: "critical",
        message: `« ${cur.label} » : bon ${cur.documentNumber} sans signature complète.`,
        phase: cur.phase,
        documentNumber: cur.documentNumber,
        documentId: cur.documentId,
      });
    }
  }
  return out;
}

function detectDocumentGaps(
  orderStatus: OrderStatus,
  steps: ResponsibilityChainStep[],
  bsEvt: { id: string; documentNumber: string; status: StockDocumentStatus; signatures: unknown[] } | undefined,
  beRet: { id: string; documentNumber: string; status: StockDocumentStatus; signatures: unknown[] } | undefined,
): ChainAnomaly[] {
  const out: ChainAnomaly[] = [];
  const active =
    orderStatus === OrderStatus.PENDING || orderStatus === OrderStatus.IN_PROGRESS;

  if (active && !bsEvt) {
    out.push({
      code: "MISSING_DOCUMENT",
      severity: "critical",
      message: "Commande active sans bon BS-EVT (sortie événement).",
      phase: ResponsibilityPhase.STOCK,
    });
  }

  if (bsEvt && bsEvt.status !== StockDocumentStatus.SIGNED) {
    const needed = totalSignaturesRequired(StockDocumentKind.BS, {
      bsSubtype: BsSubtype.BS_EVT,
    });
    const count = bsEvt.signatures.length;
    if (count < needed) {
      out.push({
        code: "MISSING_SIGNATURE",
        severity: orderStatus === OrderStatus.IN_PROGRESS ? "critical" : "warning",
        message: `BS-EVT ${bsEvt.documentNumber} : ${count}/${needed} signature(s).`,
        phase:
          count === 0
            ? ResponsibilityPhase.STOCK
            : count === 1
              ? ResponsibilityPhase.TRANSPORT
              : ResponsibilityPhase.SITE,
        documentNumber: bsEvt.documentNumber,
        documentId: bsEvt.id,
      });
    }
  }

  if (orderStatus === OrderStatus.IN_PROGRESS && bsEvt?.status !== StockDocumentStatus.SIGNED) {
    out.push({
      code: "MISSING_SIGNATURE",
      severity: "critical",
      message: "Prestation en cours : le BS-EVT doit être entièrement signé (3 signatures).",
      phase: ResponsibilityPhase.SITE,
      documentNumber: bsEvt?.documentNumber,
      documentId: bsEvt?.id,
    });
  }

  const siteStep = steps.find((s) => s.phase === ResponsibilityPhase.SITE);
  if (
    siteStep?.status === "active" &&
    beRet &&
    beRet.status !== StockDocumentStatus.SIGNED
  ) {
    const needed = totalSignaturesRequired(StockDocumentKind.BE, {
      beSubtype: BeSubtype.BE_RET,
    });
    if (beRet.signatures.length < needed) {
      out.push({
        code: "MISSING_SIGNATURE",
        severity: "warning",
        message: `BE-RET ${beRet.documentNumber} : ${beRet.signatures.length}/${needed} signature(s).`,
        phase: ResponsibilityPhase.RETURN_STOCK,
        documentNumber: beRet.documentNumber,
        documentId: beRet.id,
      });
    }
  }

  if (orderStatus === OrderStatus.SETTLED && (!beRet || beRet.status !== StockDocumentStatus.SIGNED)) {
    out.push({
      code: "MISSING_DOCUMENT",
      severity: "warning",
      message: "Commande soldée sans BE-RET signé (retour stock).",
      phase: ResponsibilityPhase.RETURN_STOCK,
      documentNumber: beRet?.documentNumber,
      documentId: beRet?.id,
    });
  }

  return out;
}

async function detectAssetPhaseSkips(
  organizationId: string,
  eventId: string,
): Promise<ChainAnomaly[]> {
  const logs = await prisma.responsibilityLog.findMany({
    where: {
      organizationId,
      eventId,
      trackedAssetId: { not: null },
    },
    include: {
      trackedAsset: { select: { tagCode: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  const byAsset = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!log.trackedAssetId) continue;
    const list = byAsset.get(log.trackedAssetId) ?? [];
    list.push(log);
    byAsset.set(log.trackedAssetId, list);
  }

  const out: ChainAnomaly[] = [];
  for (const [, assetLogs] of byAsset) {
    let lastOrder = 0;
    for (const log of assetLogs) {
      const order = PHASE_ORDER.get(log.phase) ?? 0;
      if (order > lastOrder + 1) {
        const skipped = CDC_RESPONSIBILITY_PHASES.find((p) => p.order === lastOrder + 1);
        out.push({
          code: "ASSET_PHASE_SKIP",
          severity: "critical",
          message: `Unité ${log.trackedAsset?.tagCode ?? "?"} : saut d'étape (${skipped?.title ?? "?"} → ${log.phase}).`,
          phase: log.phase,
          tagCode: log.trackedAsset?.tagCode ?? undefined,
        });
      }
      lastOrder = Math.max(lastOrder, order);
    }
  }
  return out;
}

export async function detectEventChainAnomalies(
  organizationId: string,
  eventId: string,
): Promise<ChainAnomaly[]> {
  const [{ steps }, event, docs] = await Promise.all([
    buildEventResponsibilityChain(organizationId, eventId),
    prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { orderStatus: true },
    }),
    prisma.stockDocument.findMany({
      where: { organizationId, eventId },
      include: { signatures: true },
    }),
  ]);

  if (!event) return [];

  const bsEvt = docs.find(
    (d) => d.kind === StockDocumentKind.BS && d.bsSubtype === BsSubtype.BS_EVT,
  );
  const beRet = docs.find(
    (d) => d.kind === StockDocumentKind.BE && d.beSubtype === BeSubtype.BE_RET,
  );

  const merged = [
    ...detectStepGaps(steps),
    ...detectDocumentGaps(event.orderStatus, steps, bsEvt, beRet),
    ...(await detectAssetPhaseSkips(organizationId, eventId)),
  ];

  const seen = new Set<string>();
  return merged.filter((a) => {
    const key = `${a.code}:${a.message}:${a.tagCode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
