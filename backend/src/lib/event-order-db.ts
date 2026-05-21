import {
  BeSubtype,
  BsSubtype,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";

import { OrderStatus, type Role } from "@prisma/client";

import { ORDER_STATUS_LABELS, ORDER_STATUS_SHORT_LABELS, orderStatusSignification } from "@/lib/cdc-labels";
import { getOrderWorkflowState, type OrderWorkflowState } from "@/lib/cdc-order-workflow";
import {
  canValidateTrioPillar,
  fieldForTrioPillar,
  getTrioValidationState,
  type OperationalTrioPillar,
  TRIO_PILLAR_LABELS,
  type TrioValidationState,
} from "@/lib/cdc-order-trio";
import { prisma } from "@/lib/prisma";
import { buildEventResponsibilityChain } from "@/lib/responsibility-chain";

export type CatalogAvailabilityRow = {
  id: string;
  name: string;
  reference: string;
  emoji: string | null;
  photoUrl: string | null;
  categoryName: string;
  stockAvailable: number;
  reservedOnPeriod: number;
  availableForPeriod: number;
  totalQuantity: number;
};

export type OrderHistoryEntry = {
  at: string;
  kind: "CREATED" | "ALLOCATION" | "DOCUMENT" | "ASSIGNMENT" | "STATUS";
  label: string;
  detail?: string;
};

export type OrderProgress = {
  percent: number;
  hasAllocations: boolean;
  bsSigned: boolean;
  beRetSigned: boolean;
  teamLeaderSet: boolean;
  vehicleSet: boolean;
  crewCount: number;
};

export async function getCatalogAvailability(
  organizationId: string,
  startsAt: Date,
  endsAt: Date,
  excludeEventId?: string,
): Promise<CatalogAvailabilityRow[]> {
  const overlapping = await prisma.event.findMany({
    where: {
      organizationId,
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      startsAt: { lte: endsAt },
      endsAt: { gte: startsAt },
      orderStatus: { not: OrderStatus.SETTLED },
    },
    include: { eventItems: true },
  });

  const reservedByItem = new Map<string, number>();
  for (const ev of overlapping) {
    for (const row of ev.eventItems) {
      reservedByItem.set(row.itemId, (reservedByItem.get(row.itemId) ?? 0) + row.quantity);
    }
  }

  let existingOnEvent = new Map<string, number>();
  if (excludeEventId) {
    const current = await prisma.event.findFirst({
      where: { id: excludeEventId, organizationId },
      include: { eventItems: true },
    });
    existingOnEvent = new Map(current?.eventItems.map((r) => [r.itemId, r.quantity]) ?? []);
  }

  const items = await prisma.item.findMany({
    where: { organizationId },
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 300,
  });

  return items.map((item) => {
    const reserved = reservedByItem.get(item.id) ?? 0;
    const ownQty = existingOnEvent.get(item.id) ?? 0;
    const availableForPeriod = Math.max(0, item.availableQty - reserved + ownQty);
    return {
      id: item.id,
      name: item.name,
      reference: item.reference,
      emoji: item.emoji,
      photoUrl: item.photoUrl,
      categoryName: item.category.name,
      stockAvailable: item.availableQty,
      reservedOnPeriod: reserved,
      availableForPeriod,
      totalQuantity: item.totalQuantity,
    };
  });
}

function computeProgress(input: {
  orderStatus: OrderStatus;
  eventItemsCount: number;
  bsSigned: boolean;
  beRetSigned: boolean;
  teamLeaderId: string | null;
  vehicleId: string | null;
  crewCount: number;
}): OrderProgress {
  const flags = [
    input.eventItemsCount > 0,
    input.bsSigned,
    input.teamLeaderId !== null,
    input.vehicleId !== null,
    input.crewCount > 0,
    input.beRetSigned,
  ];
  const done = flags.filter(Boolean).length;
  return {
    percent: Math.round((done / flags.length) * 100),
    hasAllocations: input.eventItemsCount > 0,
    bsSigned: input.bsSigned,
    beRetSigned: input.beRetSigned,
    teamLeaderSet: input.teamLeaderId !== null,
    vehicleSet: input.vehicleId !== null,
    crewCount: input.crewCount,
  };
}

export async function getEventOrderDetail(organizationId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: {
      owner: { select: { id: true, fullName: true, role: true } },
      commercial: { select: { id: true, fullName: true, role: true } },
      teamLeader: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, label: true, plateNumber: true, status: true } },
      eventItems: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              reference: true,
              emoji: true,
              photoUrl: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error("Commande introuvable");
  }

  const [assignments, documents, crewCount] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { organizationId, eventId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { assignedAt: "asc" },
    }),
    prisma.stockDocument.findMany({
      where: { organizationId, eventId },
      include: {
        signatures: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectAssignment.count({ where: { organizationId, eventId } }),
  ]);

  const bsEvt = documents.find(
    (d) => d.kind === StockDocumentKind.BS && d.bsSubtype === BsSubtype.BS_EVT,
  );
  const beRet = documents.find(
    (d) => d.kind === StockDocumentKind.BE && d.beSubtype === BeSubtype.BE_RET,
  );

  const progress = computeProgress({
    orderStatus: event.orderStatus,
    eventItemsCount: event.eventItems.length,
    bsSigned: bsEvt?.status === StockDocumentStatus.SIGNED,
    beRetSigned: beRet?.status === StockDocumentStatus.SIGNED,
    teamLeaderId: event.teamLeaderId,
    vehicleId: event.vehicleId,
    crewCount,
  });

  const workflow = await getOrderWorkflowState(organizationId, eventId);

  const chain = await buildEventResponsibilityChain(organizationId, eventId);

  const history: OrderHistoryEntry[] = [
    {
      at: event.createdAt.toISOString(),
      kind: "CREATED" as const,
      label: "Commande créée",
      detail: `${event.clientName} · ${event.location}`,
    },
    ...event.eventItems.map(
      (row): OrderHistoryEntry => ({
        at: row.createdAt.toISOString(),
        kind: "ALLOCATION",
        label: "Matériel réservé",
        detail: `${row.quantity}× ${row.item.name}`,
      }),
    ),
    ...documents.map(
      (doc): OrderHistoryEntry => ({
        at: (doc.signedAt ?? doc.createdAt).toISOString(),
        kind: "DOCUMENT",
        label: `${doc.kind} ${doc.documentNumber}`,
        detail: doc.status,
      }),
    ),
    ...assignments.map(
      (a): OrderHistoryEntry => ({
        at: a.assignedAt.toISOString(),
        kind: "ASSIGNMENT",
        label: a.isTeamLeader ? "Chef d'équipe désigné" : "Affectation équipe",
        detail: a.user.fullName,
      }),
    ),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const trio = getTrioValidationState(event);

  return {
    event,
    assignments,
    documents,
    progress,
    workflow,
    chain,
    history,
    trio,
    orderStatusLabel: ORDER_STATUS_LABELS[event.orderStatus],
    orderStatusShortLabel: ORDER_STATUS_SHORT_LABELS[event.orderStatus],
    orderStatusSignification: orderStatusSignification(event.orderStatus),
  };
}

export class EventOrderDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EventOrderDbError";
  }
}

export async function recordOperationalTrioValidation(
  organizationId: string,
  eventId: string,
  pillar: OperationalTrioPillar,
  actorId: string,
  actorRole: Role,
): Promise<{ trio: TrioValidationState; pillar: OperationalTrioPillar }> {
  if (!canValidateTrioPillar(actorRole, pillar)) {
    throw new EventOrderDbError(
      `Droit insuffisant pour valider le pilier ${TRIO_PILLAR_LABELS[pillar]}.`,
      403,
    );
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
  });
  if (!event) {
    throw new EventOrderDbError("Commande introuvable", 404);
  }
  if (event.orderStatus !== OrderStatus.PENDING) {
    throw new EventOrderDbError(
      "La validation trio n'est possible qu'au statut « Non traitée ».",
      400,
    );
  }

  const fields = fieldForTrioPillar(pillar);
  if (event[fields.at]) {
    throw new EventOrderDbError(`${TRIO_PILLAR_LABELS[pillar]} déjà validé.`, 409);
  }

  const now = new Date();
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      [fields.at]: now,
      [fields.userId]: actorId,
    },
  });

  return {
    trio: getTrioValidationState(updated),
    pillar,
  };
}

export type { OrderWorkflowState };

export function renderEventOrderHtml(
  detail: Awaited<ReturnType<typeof getEventOrderDetail>>,
  organizationName: string,
): string {
  const ev = detail.event;
  const lines = ev.eventItems
    .map(
      (row) =>
        `<tr><td>${row.item.name}</td><td>${row.item.reference}</td><td>${row.quantity}</td></tr>`,
    )
    .join("");
  const hist = detail.history
    .map(
      (h) =>
        `<tr><td>${new Date(h.at).toLocaleString("fr-FR")}</td><td>${h.label}</td><td>${h.detail ?? ""}</td></tr>`,
    )
    .join("");
  const docs = detail.documents
    .map((d) => `<tr><td>${d.documentNumber}</td><td>${d.kind}</td><td>${d.status}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Commande ${ev.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.35rem; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 0.85rem; }
    th { background: #f4f4f5; }
    .meta { font-size: 0.9rem; color: #444; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Imprimer / PDF</button>
  <h1>Commande événement — ${ev.name}</h1>
  <p class="meta"><strong>${organizationName}</strong> · ${detail.orderStatusLabel}</p>
  <p class="meta">Client : ${ev.clientName}</p>
  <p class="meta">Site : ${ev.location}</p>
  <p class="meta">Début : ${new Date(ev.startsAt).toLocaleDateString("fr-FR")} · Retour : ${new Date(ev.endsAt).toLocaleDateString("fr-FR")}</p>
  <p class="meta">Commercial : ${detail.event.commercial?.fullName ?? detail.event.owner.fullName}</p>
  <p class="meta">Chef d'équipe : ${detail.event.teamLeader?.fullName ?? "—"} · Véhicule : ${detail.event.vehicle ? `${detail.event.vehicle.label} (${detail.event.vehicle.plateNumber})` : "—"}</p>
  <p class="meta">Avancement : ${detail.progress.percent} %</p>
  <h2>Matériel commandé</h2>
  <table><thead><tr><th>Article</th><th>Réf.</th><th>Qté</th></tr></thead><tbody>${lines || "<tr><td colspan=\"3\">Aucune ligne</td></tr>"}</tbody></table>
  <h2>Bons associés</h2>
  <table><thead><tr><th>Numéro</th><th>Type</th><th>Statut</th></tr></thead><tbody>${docs || "<tr><td colspan=\"3\">—</td></tr>"}</tbody></table>
  <h2>Historique</h2>
  <table><thead><tr><th>Date</th><th>Événement</th><th>Détail</th></tr></thead><tbody>${hist}</tbody></table>
  <p class="meta" style="margin-top:24px">Export EVENT//RFID — ${new Date().toLocaleString("fr-FR")}</p>
</body>
</html>`;
}
