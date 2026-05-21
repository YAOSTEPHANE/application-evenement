import { BtTransitPhase, OrderStatus, StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { notifyRoleGroup } from "@/lib/cdc-notification-dispatch";
import { prisma } from "@/lib/prisma";

export type CdcAlertRunResult = {
  returnEveAlerts: number;
  overdueReturnAlerts: number;
  staleTransferAlerts: number;
  pendingSignatureAlerts: number;
  pendingBsAlerts: number;
  disputedAlerts: number;
};

/** Alertes planifiées CDC : J+1 retour, J+3 escalade, transfert > 48 h, signatures en attente */
export async function runCdcScheduledAlerts(organizationId: string): Promise<CdcAlertRunResult> {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const fortyEightHoursAgo = new Date(now);
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

  let returnEveAlerts = 0;
  let overdueReturnAlerts = 0;
  let staleTransferAlerts = 0;
  let pendingSignatureAlerts = 0;
  let pendingBsAlerts = 0;
  let disputedAlerts = 0;

  const endingTomorrow = await prisma.event.findMany({
    where: {
      organizationId,
      orderStatus: OrderStatus.IN_PROGRESS,
      endsAt: { gte: tomorrowStart, lt: tomorrowEnd },
    },
    select: { id: true, name: true },
  });

  for (const ev of endingTomorrow) {
    const hasBeRet = await prisma.stockDocument.findFirst({
      where: {
        organizationId,
        eventId: ev.id,
        kind: StockDocumentKind.BE,
        beSubtype: "BE_RET",
        status: { not: StockDocumentStatus.CANCELLED },
      },
    });
    if (!hasBeRet) {
      returnEveAlerts += 1;
      await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "COMMERCIAL", "TECHNICAL_MANAGER"], {
        module: "alertes",
        title: "Retour matériel J+1",
        body: `« ${ev.name} » se termine demain — préparer le BE-RET et la veille retour.`,
        targetType: "Event",
        targetId: ev.id,
        severity: "WARNING",
      });
    }
  }

  const overdueEvents = await prisma.event.findMany({
    where: {
      organizationId,
      orderStatus: OrderStatus.IN_PROGRESS,
      endsAt: { lt: threeDaysAgo },
    },
    select: { id: true, name: true, endsAt: true },
  });

  for (const ev of overdueEvents) {
    overdueReturnAlerts += 1;
    await notifyRoleGroup(prisma, organizationId, ["ADMIN", "MANAGER", "STOREKEEPER"], {
      module: "alertes",
      title: "Escalade retour J+3",
      body: `« ${ev.name} » terminé depuis plus de 3 jours sans clôture BE-RET.`,
      targetType: "Event",
      targetId: ev.id,
      severity: "URGENT",
    });
  }

  const staleBt = await prisma.stockDocument.findMany({
    where: {
      organizationId,
      kind: StockDocumentKind.BT,
      btTransitPhase: BtTransitPhase.IN_TRANSIT,
      status: StockDocumentStatus.SIGNED,
      updatedAt: { lt: fortyEightHoursAgo },
    },
    select: { id: true, documentNumber: true },
  });

  for (const doc of staleBt) {
    staleTransferAlerts += 1;
    await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "ADMIN"], {
      module: "mouvements",
      title: "Transfert > 48 h",
      body: `${doc.documentNumber} — matériel toujours en transit.`,
      targetType: "StockDocument",
      targetId: doc.id,
      severity: "WARNING",
    });
  }

  const pendingSign = await prisma.stockDocument.findMany({
    where: {
      organizationId,
      status: { in: [StockDocumentStatus.PENDING_SIGNATURE, StockDocumentStatus.SCANNING] },
    },
    select: { id: true, documentNumber: true, kind: true },
    take: 30,
  });

  if (pendingSign.length > 0) {
    pendingSignatureAlerts = pendingSign.length;
    await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "TECHNICAL_MANAGER", "FLEET_MANAGER"], {
      module: "alertes",
      title: "Bons en attente de signature",
      body: `${pendingSign.length} bon(s) à finaliser (ex. ${pendingSign[0]?.documentNumber ?? ""}).`,
      targetType: "StockDocument",
      targetId: pendingSign[0]?.id,
      severity: "INFO",
    });
  }

  const pendingOrders = await prisma.event.findMany({
    where: { organizationId, orderStatus: OrderStatus.PENDING },
    select: { id: true, name: true },
    take: 20,
  });

  for (const ev of pendingOrders) {
    const hasBs = await prisma.stockDocument.findFirst({
      where: {
        organizationId,
        eventId: ev.id,
        kind: StockDocumentKind.BS,
        bsSubtype: "BS_EVT",
        status: { not: StockDocumentStatus.CANCELLED },
      },
    });
    if (!hasBs) {
      pendingBsAlerts += 1;
      await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "COMMERCIAL"], {
        module: "commandes",
        title: "Commande sans BS-EVT",
        body: `« ${ev.name} » — générer le bon de sortie avant expédition.`,
        targetType: "Event",
        targetId: ev.id,
        severity: "WARNING",
      });
    }
  }

  const disputed = await prisma.stockDocument.findMany({
    where: { organizationId, status: StockDocumentStatus.DISPUTED },
    select: { id: true, documentNumber: true },
    take: 10,
  });

  for (const doc of disputed) {
    disputedAlerts += 1;
    await notifyRoleGroup(prisma, organizationId, ["ADMIN", "TECHNICAL_MANAGER"], {
      module: "alertes",
      title: "Écart RFID / litige",
      body: `${doc.documentNumber} — rapprochement à corriger.`,
      targetType: "StockDocument",
      targetId: doc.id,
      severity: "URGENT",
      channels: ["IN_APP", "EMAIL", "WHATSAPP"],
    });
  }

  return {
    returnEveAlerts,
    overdueReturnAlerts,
    staleTransferAlerts,
    pendingSignatureAlerts,
    pendingBsAlerts,
    disputedAlerts,
  };
}
