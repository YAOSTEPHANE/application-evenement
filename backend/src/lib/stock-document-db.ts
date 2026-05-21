import {
  BeSubtype,
  BsSubtype,
  BtSubtype,
  BtTransitPhase,
  OrderStatus,
  ResponsibilityPhase,
  StockDocumentKind,
  StockDocumentStatus,
  ReturnCondition,
  TrackedAssetStatus,
  type Prisma,
  type Role,
} from "@prisma/client";
import { z } from "zod";

import {
  assertCanSignDocument,
  canCancelStockDocument,
  canCreateStockDocument,
  signSlotsForDocument,
  totalSignaturesRequired,
} from "@/lib/cdc-validation-matrix";
import { dispatchCdcNotification, notifyRoleGroup } from "@/lib/cdc-notification-dispatch";
import { assertBeMandatoryFieldsForSignature } from "@/lib/cdc-be-document";
import { assertBsMandatoryFieldsForSignature } from "@/lib/cdc-bs-document";
import {
  assertBtMandatoryFieldsForSignature,
  btAllSignSlots,
  btDisputeDeadlineFrom,
  btRequiresEvent,
  btTransferQuantityDiscrepancy,
} from "@/lib/cdc-bt-document";
import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";
import { getTrioValidationState, trioBlockerMessage } from "@/lib/cdc-order-trio";
import { assertStockDocumentMutable } from "@/lib/cdc-stock-document-rules";
import { archiveSignedDocument } from "@/lib/document-archive";
import { logCustodyForDocumentLines } from "@/lib/responsibility-db";
import { buildPortalScanAlert } from "@/lib/rfid-scan-alerts";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

export class StockDocumentDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StockDocumentDbError";
  }
}

const lineSchema = z.object({
  trackedAssetId: objectId.optional(),
  itemId: objectId,
  itemVariantId: objectId.optional(),
  designation: z.string().max(200).optional(),
  expectedQty: z.number().int().positive().default(1),
});

export const createStockDocumentSchema = z.object({
  kind: z.nativeEnum(StockDocumentKind),
  beSubtype: z.nativeEnum(BeSubtype).optional(),
  bsSubtype: z.nativeEnum(BsSubtype).optional(),
  btSubtype: z.nativeEnum(BtSubtype).optional(),
  eventId: objectId.optional(),
  sourceReference: z.string().max(120).optional(),
  fromWarehouseId: objectId.optional(),
  toWarehouseId: objectId.optional(),
  shipperUserId: objectId.optional(),
  receiverUserId: objectId.optional(),
  driverUserId: objectId.optional(),
  notes: z.string().max(2000).optional(),
  photoUrls: z.array(z.string().max(500_000)).max(8).optional(),
  lines: z.array(lineSchema).min(1),
});

const photoPatchSchema = z.object({
  photoUrls: z.array(z.string().max(500_000)).min(1).max(8),
  lineId: objectId.optional(),
});

export type CreateStockDocumentInput = z.infer<typeof createStockDocumentSchema>;

const documentInclude = {
  lines: true,
  signatures: { include: { user: { select: { id: true, fullName: true, role: true } } } },
  scanBatches: { orderBy: { scannedAt: "desc" as const }, take: 5 },
  event: { select: { id: true, name: true, clientName: true, orderStatus: true } },
  fromWarehouse: { select: { id: true, name: true, code: true } },
  toWarehouse: { select: { id: true, name: true, code: true } },
  shipper: { select: { id: true, fullName: true, role: true } },
  receiver: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.StockDocumentInclude;

async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  kind: StockDocumentKind,
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await tx.documentSequence.findUnique({
    where: { organizationId_kind_year: { organizationId, kind, year } },
  });
  const next = (existing?.lastNumber ?? 0) + 1;
  await tx.documentSequence.upsert({
    where: { organizationId_kind_year: { organizationId, kind, year } },
    create: { organizationId, kind, year, lastNumber: next },
    update: { lastNumber: next },
  });
  const prefix = kind;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

export function requiredSignatureRoles(
  kind: StockDocumentKind,
  bsSubtype?: BsSubtype | null,
  beSubtype?: BeSubtype | null,
  btSubtype?: BtSubtype | null,
): Role[] {
  if (kind === StockDocumentKind.BT) {
    return btAllSignSlots(btSubtype).map((s) => s.role);
  }
  return signSlotsForDocument(kind, { bsSubtype, beSubtype }).map((s) => s.role);
}

function btReceiveCustodyPhase(
  btSubtype: BtSubtype | null,
  eventId: string | null | undefined,
): ResponsibilityPhase {
  if (btSubtype === BtSubtype.BT_SE) return ResponsibilityPhase.RETURN_STOCK;
  if (eventId || btSubtype === BtSubtype.BT_ES) return ResponsibilityPhase.SITE;
  return ResponsibilityPhase.STOCK;
}

async function applySignedDocumentEffects(
  tx: Prisma.TransactionClient,
  signed: Prisma.StockDocumentGetPayload<{ include: { lines: true } }>,
) {
  if (signed.kind === StockDocumentKind.BS && signed.bsSubtype === BsSubtype.BS_EVT) {
    for (const line of signed.lines) {
      if (line.trackedAssetId) {
        await tx.trackedAsset.update({
          where: { id: line.trackedAssetId },
          data: {
            status: TrackedAssetStatus.ON_SITE,
            currentEventId: signed.eventId,
            currentWarehouseId: null,
          },
        });
      }
    }
  }
  if (signed.kind === StockDocumentKind.BE && signed.beSubtype === BeSubtype.BE_FRN) {
    for (const line of signed.lines) {
      if (line.trackedAssetId) {
        await tx.trackedAsset.update({
          where: { id: line.trackedAssetId },
          data: {
            status: TrackedAssetStatus.AVAILABLE,
            currentWarehouseId: signed.toWarehouseId ?? undefined,
          },
        });
      }
    }
  }
  if (signed.kind === StockDocumentKind.BT && signed.btTransitPhase === BtTransitPhase.IN_TRANSIT) {
    for (const line of signed.lines) {
      if (line.trackedAssetId) {
        await tx.trackedAsset.update({
          where: { id: line.trackedAssetId },
          data: {
            status: TrackedAssetStatus.IN_TRANSIT,
            currentWarehouseId: null,
          },
        });
      }
    }
  }
  if (
    signed.kind === StockDocumentKind.BT &&
    signed.status === StockDocumentStatus.SIGNED
  ) {
    for (const line of signed.lines) {
      if (line.trackedAssetId) {
        await tx.trackedAsset.update({
          where: { id: line.trackedAssetId },
          data: {
            status: TrackedAssetStatus.AVAILABLE,
            currentWarehouseId: signed.toWarehouseId ?? undefined,
          },
        });
      }
    }
  }
}

export type ListStockDocumentsFilters = {
  kind?: StockDocumentKind;
  status?: StockDocumentStatus;
  eventId?: string;
  search?: string;
};

export async function listStockDocuments(
  organizationId: string,
  filters?: ListStockDocumentsFilters,
) {
  const search = filters?.search?.trim();
  return prisma.stockDocument.findMany({
    where: {
      organizationId,
      ...(filters?.kind ? { kind: filters.kind } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.eventId ? { eventId: filters.eventId } : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: documentInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function getStockDocument(organizationId: string, id: string) {
  const doc = await prisma.stockDocument.findFirst({
    where: { id, organizationId },
    include: documentInclude,
  });
  if (!doc) {
    throw new StockDocumentDbError("Bon introuvable", 404);
  }
  return doc;
}

export async function createStockDocument(
  organizationId: string,
  raw: unknown,
  actorRole?: Role,
) {
  const payload = createStockDocumentSchema.parse(raw);
  if (actorRole && !canCreateStockDocument(actorRole, payload.kind)) {
    throw new StockDocumentDbError("Droits insuffisants pour créer ce bon", 403);
  }
  if (payload.kind === StockDocumentKind.BE && !payload.beSubtype) {
    throw new StockDocumentDbError("Sous-type BE requis", 400);
  }
  if (payload.kind === StockDocumentKind.BS && !payload.bsSubtype) {
    throw new StockDocumentDbError("Sous-type BS requis", 400);
  }
  if (payload.kind === StockDocumentKind.BT && !payload.btSubtype) {
    throw new StockDocumentDbError("Sous-type BT requis", 400);
  }
  if (
    payload.kind === StockDocumentKind.BT &&
    payload.fromWarehouseId &&
    payload.toWarehouseId &&
    payload.fromWarehouseId === payload.toWarehouseId
  ) {
    throw new StockDocumentDbError("Sites source et destinataire doivent être distincts", 400);
  }
  if (payload.kind === StockDocumentKind.BT && btRequiresEvent(payload.btSubtype) && !payload.eventId) {
    throw new StockDocumentDbError("Événement requis pour ce sous-type BT", 400);
  }

  return prisma.$transaction(async (tx) => {
    const documentNumber = await allocateDocumentNumber(tx, organizationId, payload.kind);
    const doc = await tx.stockDocument.create({
      data: {
        organizationId,
        kind: payload.kind,
        beSubtype: payload.beSubtype,
        bsSubtype: payload.bsSubtype,
        btSubtype: payload.btSubtype,
        documentNumber,
        status: StockDocumentStatus.DRAFT,
        eventId: payload.eventId,
        sourceReference: payload.sourceReference,
        fromWarehouseId: payload.fromWarehouseId,
        toWarehouseId: payload.toWarehouseId,
        shipperUserId: payload.shipperUserId,
        receiverUserId: payload.receiverUserId,
        driverUserId: payload.driverUserId,
        notes: payload.notes,
        photoUrls: payload.photoUrls ?? [],
        btTransitPhase:
          payload.kind === StockDocumentKind.BT ? BtTransitPhase.DEPARTURE : undefined,
        lines: {
          create: payload.lines.map((line) => ({
            trackedAssetId: line.trackedAssetId,
            itemId: line.itemId,
            itemVariantId: line.itemVariantId,
            designation: line.designation,
            expectedQty: line.expectedQty,
            receivedQty: 0,
            scannedQty: 0,
          })),
        },
      },
      include: documentInclude,
    });

    await notifyRoleGroup(tx, organizationId, ["STOREKEEPER", "TECHNICAL_MANAGER", "FLEET_MANAGER", "ADMIN"], {
      module: "mouvements",
      title: `${payload.kind} créé`,
      body: `${documentNumber} — en attente de traitement`,
      targetType: "StockDocument",
      targetId: doc.id,
      severity: "INFO",
    });

    return doc;
  });
}

export async function recordDocumentScan(
  organizationId: string,
  documentId: string,
  raw: {
    tagCodes: string[];
    source: "PORTAL" | "HANDHELD";
    rfidPortalId?: string | null;
    rfidHandheldId?: string | null;
  },
) {
  const tagCodes = z
    .array(z.string().min(3).max(40))
    .min(1)
    .parse(raw.tagCodes)
    .map((t) => t.trim().toUpperCase());
  const source = raw.source === "HANDHELD" ? "HANDHELD" : "PORTAL";

  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.findFirst({
      where: { id: documentId, organizationId },
      include: { lines: true },
    });
    if (!doc) {
      throw new StockDocumentDbError("Bon introuvable", 404);
    }
    if (doc.status === StockDocumentStatus.SIGNED || doc.status === StockDocumentStatus.CANCELLED) {
      throw new StockDocumentDbError("Bon déjà clôturé", 409);
    }

    await tx.rfidScanBatch.create({
      data: {
        stockDocumentId: doc.id,
        source,
        tagCodes,
        rfidPortalId: raw.rfidPortalId ?? null,
        rfidHandheldId: raw.rfidHandheldId ?? null,
      },
    });

    const assets = await tx.trackedAsset.findMany({
      where: { organizationId, tagCode: { in: tagCodes } },
    });
    const byTag = new Map(assets.map((a) => [a.tagCode, a]));

    let mismatch = false;
    const isBt = doc.kind === StockDocumentKind.BT;
    const btReceptionPhase =
      isBt &&
      (doc.btTransitPhase === BtTransitPhase.IN_TRANSIT ||
        doc.btTransitPhase === BtTransitPhase.ARRIVAL);

    for (const line of doc.lines) {
      const matched = tagCodes.filter((tag) => {
        const asset = byTag.get(tag);
        if (!asset) return false;
        if (line.trackedAssetId) return asset.id === line.trackedAssetId;
        return asset.itemId === line.itemId;
      }).length;

      if (isBt && btReceptionPhase) {
        const receivedQty = Math.min(line.expectedQty, matched);
        if (receivedQty !== line.scannedQty) mismatch = true;
        await tx.documentLine.update({
          where: { id: line.id },
          data: { receivedQty },
        });
      } else if (isBt) {
        const scannedQty = Math.min(line.expectedQty, matched);
        if (scannedQty < line.expectedQty) mismatch = true;
        await tx.documentLine.update({
          where: { id: line.id },
          data: { scannedQty, receivedQty: 0 },
        });
      } else {
        const scannedQty = Math.min(line.expectedQty, matched);
        if (scannedQty < line.expectedQty) mismatch = true;
        await tx.documentLine.update({
          where: { id: line.id },
          data: {
            scannedQty,
            receivedQty: scannedQty,
            ...(doc.kind === StockDocumentKind.BE && !line.lineCondition
              ? { lineCondition: ReturnCondition.OK }
              : {}),
          },
        });
        if (scannedQty < line.expectedQty && line.trackedAssetId) {
          await tx.trackedAsset.update({
            where: { id: line.trackedAssetId },
            data: { status: TrackedAssetStatus.QUARANTINE },
          });
        }
      }
    }

    const unknownTags = tagCodes.filter((t) => !byTag.has(t));
    if (unknownTags.length > 0) mismatch = true;

    const nextStatus =
      mismatch ? StockDocumentStatus.DISPUTED : StockDocumentStatus.PENDING_SIGNATURE;

    const updated = await tx.stockDocument.update({
      where: { id: doc.id },
      data: {
        status: doc.status === StockDocumentStatus.DRAFT ? StockDocumentStatus.SCANNING : nextStatus,
        portalValidatedAt: source === "PORTAL" ? new Date() : doc.portalValidatedAt,
        ...(isBt && btReceptionPhase ? { btReceptionScannedAt: new Date() } : {}),
        anomalyNotes: mismatch
          ? isBt && btReceptionPhase
            ? `Écart transfert expédié/reçu — litige §7.4.2`
            : `Écart scan : tags inconnus ou quantités (${unknownTags.join(", ")})`
          : doc.anomalyNotes,
      },
      include: documentInclude,
    });

    if (mismatch) {
      const roles =
        isBt && btReceptionPhase ? (["ADMIN"] as Role[]) : (["ADMIN", "STOREKEEPER"] as Role[]);
      await notifyRoleGroup(tx, organizationId, roles, {
        module: "mouvements",
        title: isBt && btReceptionPhase ? "Litige transfert — écart quantités" : "Écart RFID — quarantaine",
        body: `${doc.documentNumber} — vérification requise`,
        targetType: "StockDocument",
        targetId: doc.id,
        severity: "URGENT",
      });
      if (isBt && btReceptionPhase) {
        const opened = new Date();
        await tx.stockDocument.update({
          where: { id: doc.id },
          data: {
            transferDisputeOpenedAt: opened,
            transferDisputeDeadline: btDisputeDeadlineFrom(opened),
          },
        });
      }
    }

    return updated;
  });
}

export async function signStockDocument(
  organizationId: string,
  documentId: string,
  userId: string,
  role: Role,
) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.findFirst({
      where: { id: documentId, organizationId },
      include: { signatures: true, lines: true },
    });
    if (!doc) {
      throw new StockDocumentDbError("Bon introuvable", 404);
    }
    if (doc.status === StockDocumentStatus.CANCELLED) {
      throw new StockDocumentDbError("Bon annulé", 409);
    }
    if (doc.status === StockDocumentStatus.DISPUTED) {
      throw new StockDocumentDbError("Régularisez le litige RFID avant signature", 409);
    }

    try {
      assertCanSignDocument(role, doc.kind, doc.signatures.length, {
        bsSubtype: doc.bsSubtype,
        beSubtype: doc.beSubtype,
        btSubtype: doc.btSubtype,
        btTransitPhase: doc.btTransitPhase,
      });
    } catch (e) {
      throw new StockDocumentDbError(e instanceof Error ? e.message : "Signature refusée", 403);
    }

    const already = doc.signatures.some((s) => s.userId === userId);
    if (!already) {
      await tx.documentSignature.create({
        data: {
          stockDocumentId: doc.id,
          userId,
          roleAtSign: role,
          signatureHash: `${userId}:${Date.now()}`,
        },
      });
    }

    const refreshed = await tx.stockDocument.findFirst({
      where: { id: doc.id },
      include: { signatures: true, lines: true },
    });
    if (!refreshed) {
      throw new StockDocumentDbError("Bon introuvable", 404);
    }

    const needed = totalSignaturesRequired(refreshed.kind, {
      bsSubtype: refreshed.bsSubtype,
      beSubtype: refreshed.beSubtype,
      btSubtype: refreshed.btSubtype,
    });
    const signedCount = refreshed.signatures.length;

    if (refreshed.kind === StockDocumentKind.BT && signedCount === 1 && signedCount < needed) {
      const emitCheck = assertBtMandatoryFieldsForSignature({
        kind: refreshed.kind,
        status: refreshed.status,
        btSubtype: refreshed.btSubtype,
        btReceptionScannedAt: refreshed.btReceptionScannedAt,
        eventId: refreshed.eventId,
        fromWarehouseId: refreshed.fromWarehouseId,
        toWarehouseId: refreshed.toWarehouseId,
        lines: refreshed.lines,
        signatureCount: 0,
        signaturesRequired: needed,
      });
      if (!emitCheck.ok) {
        throw new StockDocumentDbError(emitCheck.message, 409);
      }
      await applySignedDocumentEffects(tx, {
        ...refreshed,
        status: StockDocumentStatus.PENDING_SIGNATURE,
        btTransitPhase: BtTransitPhase.IN_TRANSIT,
      });
      await logCustodyForDocumentLines(tx, {
        organizationId,
        eventId: refreshed.eventId,
        stockDocumentId: refreshed.id,
        phase: ResponsibilityPhase.TRANSPORT,
        holderUserId: userId,
        lines: refreshed.lines,
      });
      return tx.stockDocument.update({
        where: { id: doc.id },
        data: {
          status: StockDocumentStatus.PENDING_SIGNATURE,
          btTransitPhase: BtTransitPhase.IN_TRANSIT,
          btEmittedAt: new Date(),
        },
        include: documentInclude,
      });
    }

    if (signedCount < needed) {
      if (refreshed.kind === StockDocumentKind.BS && refreshed.bsSubtype === BsSubtype.BS_EVT) {
        const phase =
          signedCount === 1
            ? ResponsibilityPhase.STOCK
            : ResponsibilityPhase.TRANSPORT;
        await logCustodyForDocumentLines(tx, {
          organizationId,
          eventId: refreshed.eventId,
          stockDocumentId: refreshed.id,
          phase,
          holderUserId: userId,
          lines: refreshed.lines,
        });
      }
      if (
        refreshed.kind === StockDocumentKind.BE &&
        refreshed.beSubtype === BeSubtype.BE_RET &&
        signedCount === 1
      ) {
        await logCustodyForDocumentLines(tx, {
          organizationId,
          eventId: refreshed.eventId,
          stockDocumentId: refreshed.id,
          phase: ResponsibilityPhase.RETURN_STOCK,
          holderUserId: userId,
          lines: refreshed.lines,
        });
      }
      return tx.stockDocument.update({
        where: { id: doc.id },
        data: { status: StockDocumentStatus.PENDING_SIGNATURE },
        include: documentInclude,
      });
    }

    const closingBsEvt =
      refreshed.kind === StockDocumentKind.BS && refreshed.bsSubtype === BsSubtype.BS_EVT;
    const closingBeRet =
      refreshed.kind === StockDocumentKind.BE && refreshed.beSubtype === BeSubtype.BE_RET;
    if (
      (closingBsEvt || closingBeRet) &&
      !documentLinesRfidComplete(refreshed.lines)
    ) {
      throw new StockDocumentDbError(
        "Signature impossible : scan RFID incomplet sur toutes les lignes du bon.",
        409,
      );
    }

    if (refreshed.kind === StockDocumentKind.BE) {
      const neededBe = totalSignaturesRequired(refreshed.kind, {
        beSubtype: refreshed.beSubtype,
      });
      if (signedCount >= neededBe) {
        const beCheck = assertBeMandatoryFieldsForSignature({
          kind: refreshed.kind,
          status: refreshed.status,
          beSubtype: refreshed.beSubtype,
          eventId: refreshed.eventId,
          toWarehouseId: refreshed.toWarehouseId,
          shipperUserId: refreshed.shipperUserId,
          receiverUserId: refreshed.receiverUserId,
          sourceReference: refreshed.sourceReference,
          lines: refreshed.lines,
          signatureCount: signedCount,
          signaturesRequired: neededBe,
        });
        if (!beCheck.ok) {
          throw new StockDocumentDbError(beCheck.message, 409);
        }
      }
    }

    if (refreshed.kind === StockDocumentKind.BS) {
      const neededBs = totalSignaturesRequired(refreshed.kind, {
        bsSubtype: refreshed.bsSubtype,
      });
      if (signedCount >= neededBs) {
        const bsCheck = assertBsMandatoryFieldsForSignature({
          kind: refreshed.kind,
          status: refreshed.status,
          bsSubtype: refreshed.bsSubtype,
          eventId: refreshed.eventId,
          fromWarehouseId: refreshed.fromWarehouseId,
          driverUserId: refreshed.driverUserId,
          lines: refreshed.lines,
          signatureCount: signedCount,
          signaturesRequired: neededBs,
        });
        if (!bsCheck.ok) {
          throw new StockDocumentDbError(bsCheck.message, 409);
        }
      }
    }

    if (refreshed.kind === StockDocumentKind.BT && signedCount >= needed) {
      const btCheck = assertBtMandatoryFieldsForSignature({
        kind: refreshed.kind,
        status: refreshed.status,
        btSubtype: refreshed.btSubtype,
        btReceptionScannedAt: refreshed.btReceptionScannedAt,
        eventId: refreshed.eventId,
        fromWarehouseId: refreshed.fromWarehouseId,
        toWarehouseId: refreshed.toWarehouseId,
        lines: refreshed.lines,
        signatureCount: signedCount,
        signaturesRequired: needed,
      });
      if (!btCheck.ok) {
        throw new StockDocumentDbError(btCheck.message, 409);
      }
      if (btTransferQuantityDiscrepancy(refreshed.lines)) {
        const opened = new Date();
        const deadline = btDisputeDeadlineFrom(opened);
        await notifyRoleGroup(tx, organizationId, ["ADMIN"], {
          module: "mouvements",
          title: "Litige de transfert §7.4.2",
          body: `${refreshed.documentNumber} — écart expédié/reçu`,
          targetType: "StockDocument",
          targetId: refreshed.id,
          severity: "URGENT",
        });
        return tx.stockDocument.update({
          where: { id: doc.id },
          data: {
            status: StockDocumentStatus.DISPUTED,
            transferDisputeOpenedAt: opened,
            transferDisputeDeadline: deadline,
            anomalyNotes: "Litige transfert — écart quantité expédiée / reçue.",
          },
          include: documentInclude,
        });
      }
    }

    const signed = await tx.stockDocument.update({
      where: { id: doc.id },
      data: {
        status: StockDocumentStatus.SIGNED,
        signedAt: new Date(),
        btTransitPhase:
          refreshed.kind === StockDocumentKind.BT ? BtTransitPhase.ARRIVAL : refreshed.btTransitPhase,
      },
      include: documentInclude,
    });

    await applySignedDocumentEffects(tx, signed);

    if (signed.kind === StockDocumentKind.BT && signed.status === StockDocumentStatus.SIGNED) {
      await logCustodyForDocumentLines(tx, {
        organizationId,
        eventId: signed.eventId,
        stockDocumentId: signed.id,
        phase: btReceiveCustodyPhase(signed.btSubtype, signed.eventId),
        holderUserId: userId,
        lines: signed.lines,
      });
    }

    if (signed.kind === StockDocumentKind.BS && signed.bsSubtype === BsSubtype.BS_EVT && signed.eventId) {
      await tx.event.update({
        where: { id: signed.eventId },
        data: { orderStatus: OrderStatus.IN_PROGRESS },
      });
      await logCustodyForDocumentLines(tx, {
        organizationId,
        eventId: signed.eventId,
        stockDocumentId: signed.id,
        phase: ResponsibilityPhase.SITE,
        holderUserId: userId,
        lines: signed.lines,
      });
    }
    if (signed.kind === StockDocumentKind.BE && signed.beSubtype === BeSubtype.BE_RET && signed.eventId) {
      for (const line of signed.lines) {
        if (line.trackedAssetId) {
          await tx.trackedAsset.update({
            where: { id: line.trackedAssetId },
            data: {
              status: TrackedAssetStatus.AVAILABLE,
              currentWarehouseId: signed.toWarehouseId ?? undefined,
              currentEventId: null,
            },
          });
        }
      }
      if (documentLinesRfidComplete(signed.lines)) {
        await tx.event.update({
          where: { id: signed.eventId },
          data: { orderStatus: OrderStatus.SETTLED, lifecycle: "COMPLETED" },
        });
        const event = await tx.event.findUnique({
          where: { id: signed.eventId },
          select: { name: true, commercialId: true, ownerId: true },
        });
        const notifyIds = [event?.commercialId, event?.ownerId].filter(Boolean) as string[];
        for (const uid of notifyIds) {
          await dispatchCdcNotification(tx, {
            organizationId,
            userId: uid,
            module: "commandes",
            title: "Commande soldée",
            body: `${event?.name ?? "Événement"} — retour matériel validé (BE-RET)`,
            targetType: "Event",
            targetId: signed.eventId!,
            severity: "SUCCESS",
          });
        }
        const technicalSigner =
          signed.signatures.find((s) => s.roleAtSign === "TECHNICAL_MANAGER")?.userId ?? userId;
        await logCustodyForDocumentLines(tx, {
          organizationId,
          eventId: signed.eventId,
          stockDocumentId: signed.id,
          phase: ResponsibilityPhase.DEMOUNT,
          holderUserId: technicalSigner,
          lines: signed.lines,
        });
      }
    }

    if (signed.status === StockDocumentStatus.SIGNED) {
      const full = await tx.stockDocument.findFirst({
        where: { id: signed.id },
        include: documentInclude,
      });
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (full && org) {
        await archiveSignedDocument(organizationId, full, org.name, tx);
      }
    }

    return signed;
  });
}

export async function cancelStockDocument(
  organizationId: string,
  documentId: string,
  role: Role,
  reason?: string,
) {
  if (!canCancelStockDocument(role)) {
    throw new StockDocumentDbError("Droits insuffisants pour annuler", 403);
  }
  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.findFirst({
      where: { id: documentId, organizationId },
    });
    if (!doc) {
      throw new StockDocumentDbError("Bon introuvable", 404);
    }
    if (doc.status === StockDocumentStatus.CANCELLED) {
      throw new StockDocumentDbError("Bon déjà annulé", 409);
    }
    if (doc.status === StockDocumentStatus.SIGNED) {
      throw new StockDocumentDbError(
        "Bon signé : utilisez un bon contraire (contre-passation) via l'administrateur.",
        409,
      );
    }
    return tx.stockDocument.update({
      where: { id: doc.id },
      data: {
        status: StockDocumentStatus.CANCELLED,
        cancelledAt: new Date(),
        anomalyNotes: reason ?? doc.anomalyNotes,
      },
      include: documentInclude,
    });
  });
}

export type PortalScanOptions = {
  warehouseId?: string;
  portalId?: string;
  portalCode?: string;
};

export async function validatePortalScan(
  organizationId: string,
  tagCodes: string[],
  options: PortalScanOptions = {},
) {
  const normalized = tagCodes.map((t) => t.trim().toUpperCase());
  let portal: {
    id: string;
    code: string;
    label: string;
    passageDirection: import("@prisma/client").PortalPassageDirection;
    installationSite: import("@prisma/client").PortalInstallationSite;
    warehouseId: string;
    active: boolean;
  } | null = null;

  if (options.portalId || options.portalCode) {
    portal = await prisma.rfidPortal.findFirst({
      where: {
        organizationId,
        active: true,
        ...(options.portalId
          ? { id: options.portalId }
          : { code: options.portalCode!.trim().toUpperCase() }),
      },
      select: {
        id: true,
        code: true,
        label: true,
        passageDirection: true,
        installationSite: true,
        warehouseId: true,
        active: true,
      },
    });
    if (!portal) {
      return {
        allowed: false,
        message: "Portique inconnu ou inactif",
        documentId: null,
        portal: null,
        documentKind: null,
        alert: {
          level: "error" as const,
          sound: true,
          visual: true,
          title: "Portique indisponible",
          detail: "Portique inconnu ou inactif",
        },
      };
    }
  }

  const warehouseId = portal?.warehouseId ?? options.warehouseId;
  const direction = portal?.passageDirection ?? "EXIT";
  const installationSite = portal?.installationSite ?? "WAREHOUSE_GATE";

  const openStatuses = [StockDocumentStatus.SCANNING, StockDocumentStatus.PENDING_SIGNATURE];

  async function tryBs(preferEventLoading = false) {
    if (preferEventLoading) {
      const evt = await prisma.stockDocument.findFirst({
        where: {
          organizationId,
          kind: StockDocumentKind.BS,
          bsSubtype: BsSubtype.BS_EVT,
          status: { in: openStatuses },
          ...(warehouseId ? { fromWarehouseId: warehouseId } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      if (evt) return evt;
    }
    return prisma.stockDocument.findFirst({
      where: {
        organizationId,
        kind: StockDocumentKind.BS,
        status: { in: openStatuses },
        ...(warehouseId ? { fromWarehouseId: warehouseId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async function tryBe() {
    return prisma.stockDocument.findFirst({
      where: {
        organizationId,
        kind: StockDocumentKind.BE,
        status: { in: openStatuses },
        ...(warehouseId ? { toWarehouseId: warehouseId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async function tryBt() {
    if (!warehouseId) return null;
    return prisma.stockDocument.findFirst({
      where: {
        organizationId,
        kind: StockDocumentKind.BT,
        status: { in: openStatuses },
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  let target: Awaited<ReturnType<typeof tryBs>> = null;
  let documentKind: "BS" | "BE" | "BT" | null = null;

  if (installationSite === "LOADING_DOCK") {
      target = await tryBt();
      documentKind = "BT";
      if (!target) {
        target = await tryBs(true);
        documentKind = "BS";
      }
      if (!target) {
        target = await tryBe();
        documentKind = "BE";
      }
  } else if (direction === "EXIT") {
    target = await tryBs(true);
    documentKind = "BS";
  } else if (direction === "ENTRY") {
    target = await tryBe();
    documentKind = "BE";
  } else {
    target = await tryBs();
    documentKind = "BS";
    if (!target) {
      target = await tryBe();
      documentKind = "BE";
    }
    if (!target) {
      target = await tryBt();
      documentKind = "BT";
    }
  }

  if (!target) {
    const hint =
      installationSite === "LOADING_DOCK"
        ? "quai (BT, BS ou BE)"
        : direction === "ENTRY"
          ? "entrée (BE)"
          : direction === "EXIT"
            ? "sortie (BS)"
            : "sortie (BS), entrée (BE) ou BT";
    const msg = `Aucun bon ouvert pour ce portique (${hint})`;
    return {
      allowed: false,
      message: msg,
      documentId: null,
      portal: portal ? { id: portal.id, code: portal.code, label: portal.label } : null,
      documentKind: null,
      alert: buildPortalScanAlert({ allowed: false, message: msg }),
    };
  }

  const result = await recordDocumentScan(organizationId, target.id, {
    tagCodes: normalized,
    source: "PORTAL",
    rfidPortalId: portal?.id ?? null,
  });

  if (portal) {
    await prisma.rfidPortal.update({
      where: { id: portal.id },
      data: { lastScanAt: new Date() },
    });
  }

  const assets = await prisma.trackedAsset.findMany({
    where: { organizationId, tagCode: { in: normalized } },
    select: { tagCode: true },
  });
  const known = new Set(assets.map((a) => a.tagCode));
  const unknownTags = normalized.filter((t) => !known.has(t));

  const blocked = result.status === StockDocumentStatus.DISPUTED;
  const message = blocked
    ? documentKind === "BS"
      ? "Écart RFID BS — sortie bloquée (liste théorique / tags véhicule)"
      : "Écart RFID — passage bloqué"
    : `Passage enregistré — rapprochement ${documentKind} (${result.documentNumber})`;

  const alert = buildPortalScanAlert({
    allowed: !blocked,
    status: result.status,
    message,
    documentNumber: result.documentNumber,
    unknownTags,
  });

  return {
    allowed: !blocked,
    message,
    documentId: target.id,
    documentNumber: result.documentNumber,
    status: result.status,
    documentKind,
    unknownTags,
    automatic: true,
    portal: portal
      ? {
          id: portal.id,
          code: portal.code,
          label: portal.label,
          installationSite,
          passageDirection: direction,
        }
      : null,
    alert,
  };
}

/** BE-RET : lignes reprises du dernier BS-EVT signé ou des affectations événement. */
export async function createBeRetFromEvent(organizationId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: { eventItems: true },
  });
  if (!event) {
    throw new StockDocumentDbError("Événement introuvable", 404);
  }
  if (event.orderStatus !== OrderStatus.IN_PROGRESS) {
    throw new StockDocumentDbError(
      "Le BE-RET n'est possible que pour une commande au statut « Traitée ».",
      400,
    );
  }

  const pendingBeRet = await prisma.stockDocument.findFirst({
    where: {
      organizationId,
      eventId,
      kind: StockDocumentKind.BE,
      beSubtype: BeSubtype.BE_RET,
      status: { notIn: [StockDocumentStatus.SIGNED, StockDocumentStatus.CANCELLED] },
    },
  });
  if (pendingBeRet) {
    throw new StockDocumentDbError(
      `Un BE-RET est déjà en cours (${pendingBeRet.documentNumber}).`,
      409,
    );
  }

  const lastBs = await prisma.stockDocument.findFirst({
    where: {
      organizationId,
      eventId,
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      status: StockDocumentStatus.SIGNED,
    },
    include: { lines: true },
    orderBy: { signedAt: "desc" },
  });

  let lines: CreateStockDocumentInput["lines"];
  let toWarehouseId: string | undefined;

  if (lastBs && lastBs.lines.length > 0) {
    toWarehouseId = lastBs.fromWarehouseId ?? undefined;
    lines = lastBs.lines.map((line) => ({
      itemId: line.itemId,
      itemVariantId: line.itemVariantId ?? undefined,
      trackedAssetId: line.trackedAssetId ?? undefined,
      expectedQty: line.expectedQty,
      designation: line.designation ?? undefined,
    }));
  } else if (event.eventItems.length > 0) {
    lines = event.eventItems.map((ei) => ({
      itemId: ei.itemId,
      itemVariantId: ei.itemVariantId ?? undefined,
      expectedQty: ei.quantity,
    }));
    const wh = await prisma.warehouse.findFirst({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
    });
    toWarehouseId = wh?.id;
  } else {
    throw new StockDocumentDbError(
      "Aucune ligne de sortie ou d'affectation pour générer le BE-RET.",
      400,
    );
  }

  return createStockDocument(organizationId, {
    kind: StockDocumentKind.BE,
    beSubtype: BeSubtype.BE_RET,
    eventId,
    toWarehouseId,
    sourceReference: lastBs?.documentNumber,
    lines,
  });
}

export async function startEventLoading(organizationId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    select: {
      orderStatus: true,
      name: true,
      stockValidatedAt: true,
      technicalValidatedAt: true,
      fleetValidatedAt: true,
    },
  });
  if (!event) {
    throw new StockDocumentDbError("Commande introuvable", 404);
  }
  if (event.orderStatus === OrderStatus.SETTLED) {
    throw new StockDocumentDbError("Commande déjà soldée.", 400);
  }
  const trioMsg = trioBlockerMessage(getTrioValidationState(event));
  if (trioMsg) {
    throw new StockDocumentDbError(trioMsg, 400);
  }
  const doc = await createBsEvtFromEvent(organizationId, eventId);
  await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "TECHNICAL_MANAGER"], {
    module: "commandes",
    title: "Chargement — BS-EVT généré",
    body: `${event.name} — ${doc.documentNumber} : scannez les tags au portique ou à la douchette.`,
    targetType: "Event",
    targetId: eventId,
    severity: "INFO",
  });
  return doc;
}

export async function startEventReturn(organizationId: string, eventId: string) {
  const doc = await createBeRetFromEvent(organizationId, eventId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    select: { name: true },
  });
  await notifyRoleGroup(prisma, organizationId, ["STOREKEEPER", "TECHNICAL_MANAGER", "FLEET_MANAGER"], {
    module: "commandes",
    title: "Retour — BE-RET généré",
    body: `${event?.name ?? "Commande"} — ${doc.documentNumber} : scan RFID obligatoire avant clôture.`,
    targetType: "Event",
    targetId: eventId,
    severity: "INFO",
  });
  return doc;
}

/** BS-EVT : généré depuis les lignes de commande (EventItem). */
export async function createBsEvtFromEvent(organizationId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    include: { eventItems: true },
  });
  if (!event) {
    throw new StockDocumentDbError("Événement introuvable", 404);
  }
  if (event.orderStatus === OrderStatus.SETTLED) {
    throw new StockDocumentDbError("Commande déjà soldée.", 400);
  }

  const openBs = await prisma.stockDocument.findFirst({
    where: {
      organizationId,
      eventId,
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      status: { notIn: [StockDocumentStatus.SIGNED, StockDocumentStatus.CANCELLED] },
    },
  });
  if (openBs) {
    return openBs;
  }

  const signedBs = await prisma.stockDocument.findFirst({
    where: {
      organizationId,
      eventId,
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      status: StockDocumentStatus.SIGNED,
    },
  });
  if (signedBs) {
    throw new StockDocumentDbError(
      `Un BS-EVT signé existe déjà (${signedBs.documentNumber}).`,
      409,
    );
  }

  if (event.eventItems.length === 0) {
    throw new StockDocumentDbError(
      "Aucune ligne de commande — affectez du matériel avant le BS-EVT.",
      400,
    );
  }

  const wh = await prisma.warehouse.findFirst({
    where: { organizationId, active: true },
    orderBy: { name: "asc" },
  });
  if (!wh) {
    throw new StockDocumentDbError("Aucun entrepôt actif pour la sortie.", 400);
  }

  const lines: CreateStockDocumentInput["lines"] = event.eventItems.map((ei) => ({
    itemId: ei.itemId,
    itemVariantId: ei.itemVariantId ?? undefined,
    expectedQty: ei.quantity,
  }));

  return createStockDocument(organizationId, {
    kind: StockDocumentKind.BS,
    bsSubtype: BsSubtype.BS_EVT,
    eventId,
    fromWarehouseId: wh.id,
    lines,
  });
}

export async function attachDocumentPhotos(
  organizationId: string,
  documentId: string,
  raw: unknown,
) {
  const payload = photoPatchSchema.parse(raw);
  const doc = await prisma.stockDocument.findFirst({
    where: { id: documentId, organizationId },
    include: { lines: true },
  });
  if (!doc) {
    throw new StockDocumentDbError("Bon introuvable", 404);
  }
  const mutable = assertStockDocumentMutable(doc.status);
  if (!mutable.ok) {
    throw new StockDocumentDbError(mutable.message, 409);
  }

  if (payload.lineId) {
    const line = doc.lines.find((l) => l.id === payload.lineId);
    if (!line) {
      throw new StockDocumentDbError("Ligne introuvable", 404);
    }
    await prisma.documentLine.update({
      where: { id: line.id },
      data: { photoUrls: [...line.photoUrls, ...payload.photoUrls].slice(0, 8) },
    });
  } else {
    await prisma.stockDocument.update({
      where: { id: doc.id },
      data: { photoUrls: [...doc.photoUrls, ...payload.photoUrls].slice(0, 8) },
    });
  }
  return getStockDocument(organizationId, documentId);
}

/** §7.5 — bon rectificatif lié à un bon signé. */
export async function createRectificatoryDocument(
  organizationId: string,
  documentId: string,
  actorRole: Role,
  reason: string,
) {
  if (actorRole !== "ADMIN" && actorRole !== "MANAGER") {
    throw new StockDocumentDbError("Rectificatif réservé à l'administration", 403);
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new StockDocumentDbError("Motif requis", 400);
  }
  const original = await getStockDocument(organizationId, documentId);
  if (original.status !== StockDocumentStatus.SIGNED) {
    throw new StockDocumentDbError("Seul un bon signé peut être rectifié", 400);
  }
  const lines = original.lines.map((line) => ({
    itemId: line.itemId,
    itemVariantId: line.itemVariantId ?? undefined,
    trackedAssetId: line.trackedAssetId ?? undefined,
    designation: line.designation ?? undefined,
    expectedQty: line.expectedQty,
  }));
  const payload: CreateStockDocumentInput = {
    kind: original.kind,
    ...(original.beSubtype ? { beSubtype: original.beSubtype } : {}),
    ...(original.bsSubtype ? { bsSubtype: original.bsSubtype } : {}),
    ...(original.btSubtype ? { btSubtype: original.btSubtype } : {}),
    eventId: original.eventId ?? undefined,
    fromWarehouseId: original.fromWarehouseId ?? undefined,
    toWarehouseId: original.toWarehouseId ?? undefined,
    sourceReference: original.documentNumber,
    notes: `Rectificatif §7.5 — ${trimmed}`,
    lines,
  };
  const created = await createStockDocument(organizationId, payload, actorRole);
  await prisma.stockDocument.update({
    where: { id: created.id },
    data: { correctsDocumentId: original.id },
  });
  return getStockDocument(organizationId, created.id);
}

/** §7.4.2 phase 3 — arbitrage administrateur litige transfert BT. */
export async function resolveBtTransferDispute(
  organizationId: string,
  documentId: string,
  actorRole: Role,
  actorUserId: string,
  resolutionNotes?: string,
) {
  if (actorRole !== "ADMIN" && actorRole !== "MANAGER") {
    throw new StockDocumentDbError("Arbitrage du litige réservé à l'administrateur", 403);
  }

  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.findFirst({
      where: {
        id: documentId,
        organizationId,
        kind: StockDocumentKind.BT,
        status: StockDocumentStatus.DISPUTED,
      },
      include: { lines: true, signatures: true },
    });
    if (!doc) {
      throw new StockDocumentDbError("Litige de transfert introuvable", 404);
    }
    if (!doc.transferDisputeOpenedAt) {
      throw new StockDocumentDbError("Ce litige n'est pas un litige de transfert BT", 400);
    }

    const signed = await tx.stockDocument.update({
      where: { id: doc.id },
      data: {
        status: StockDocumentStatus.SIGNED,
        signedAt: new Date(),
        btTransitPhase: BtTransitPhase.ARRIVAL,
        anomalyNotes: resolutionNotes?.trim()
          ? `Litige tranché : ${resolutionNotes.trim()}`
          : "Litige transfert tranché par l'administrateur (§7.4.2).",
        transferDisputeOpenedAt: null,
        transferDisputeDeadline: null,
      },
      include: documentInclude,
    });

    await applySignedDocumentEffects(tx, { ...signed, lines: doc.lines });
    await logCustodyForDocumentLines(tx, {
      organizationId,
      eventId: signed.eventId,
      stockDocumentId: signed.id,
      phase: btReceiveCustodyPhase(signed.btSubtype, signed.eventId),
      holderUserId: actorUserId,
      lines: doc.lines,
    });

    await notifyRoleGroup(tx, organizationId, ["STOREKEEPER", "TECHNICAL_MANAGER"], {
      module: "mouvements",
      title: "Litige transfert clos",
      body: `${signed.documentNumber} — arbitrage administrateur enregistré`,
      targetType: "StockDocument",
      targetId: signed.id,
      severity: "SUCCESS",
    });

    return signed;
  });
}

/** Contre-passation : bon contraire pour un document signé (admin). */
export async function createContraDocument(
  organizationId: string,
  documentId: string,
  actorRole: Role,
  reason: string,
) {
  if (actorRole !== "ADMIN" && actorRole !== "MANAGER") {
    throw new StockDocumentDbError("Contre-passation réservée à l'administration", 403);
  }
  const original = await getStockDocument(organizationId, documentId);
  if (original.status !== StockDocumentStatus.SIGNED) {
    throw new StockDocumentDbError("Seuls les bons signés peuvent être contrepassés", 400);
  }
  const existingContra = await prisma.stockDocument.findFirst({
    where: { organizationId, reversesDocumentId: original.id },
  });
  if (existingContra) {
    throw new StockDocumentDbError(
      `Contre-passation déjà émise (${existingContra.documentNumber}).`,
      409,
    );
  }

  const lines = original.lines.map((line) => ({
    itemId: line.itemId,
    itemVariantId: line.itemVariantId ?? undefined,
    trackedAssetId: line.trackedAssetId ?? undefined,
    expectedQty: line.expectedQty,
    designation: line.designation ?? undefined,
  }));

  let contraPayload: CreateStockDocumentInput;
  if (original.kind === StockDocumentKind.BS && original.bsSubtype === BsSubtype.BS_EVT) {
    contraPayload = {
      kind: StockDocumentKind.BE,
      beSubtype: BeSubtype.BE_RET,
      eventId: original.eventId ?? undefined,
      toWarehouseId: original.fromWarehouseId ?? undefined,
      sourceReference: original.documentNumber,
      notes: `Contre-passation : ${reason}`,
      lines,
    };
  } else if (original.kind === StockDocumentKind.BE) {
    contraPayload = {
      kind: StockDocumentKind.BS,
      bsSubtype: BsSubtype.BS_EVT,
      eventId: original.eventId ?? undefined,
      fromWarehouseId: original.toWarehouseId ?? undefined,
      sourceReference: original.documentNumber,
      notes: `Contre-passation : ${reason}`,
      lines,
    };
  } else {
    throw new StockDocumentDbError("Contre-passation non supportée pour ce type de bon", 400);
  }

  const contra = await createStockDocument(organizationId, contraPayload, actorRole);
  await prisma.stockDocument.update({
    where: { id: contra.id },
    data: { reversesDocumentId: original.id },
  });
  return getStockDocument(organizationId, contra.id);
}
