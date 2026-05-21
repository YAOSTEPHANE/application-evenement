import {
  ItemCondition,
  RfidTagType,
  TrackedAssetStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { conditionRequiresQuarantine, resolveAssetStatusFromCondition } from "@/lib/rfid-quarantine";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

export class RfidDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RfidDbError";
  }
}

const tagCodeSchema = z
  .string()
  .regex(/^TAG-[A-Z0-9]{2,8}-\d{4}$/i, "Format attendu : TAG-XXXX-YYYY");

const photoSchema = z
  .string()
  .max(500_000)
  .refine((s) => s.startsWith("http") || s.startsWith("data:image"), "Photo invalide");

export const createTrackedAssetSchema = z.object({
  tagCode: tagCodeSchema,
  itemId: objectId,
  itemVariantId: objectId.optional(),
  rfidTagType: z.nativeEnum(RfidTagType),
  condition: z.nativeEnum(ItemCondition).optional(),
  currentWarehouseId: objectId.optional(),
  photoUrl: photoSchema.optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export const updateTrackedAssetSchema = z.object({
  rfidTagType: z.nativeEnum(RfidTagType).optional(),
  condition: z.nativeEnum(ItemCondition).optional(),
  status: z.nativeEnum(TrackedAssetStatus).optional(),
  currentWarehouseId: objectId.optional().nullable(),
  photoUrl: photoSchema.optional().or(z.literal("")).nullable(),
  notes: z.string().max(500).optional().nullable(),
  custodianUserId: objectId.optional().nullable(),
});

export type TrackedAssetListFilters = {
  q?: string;
  status?: TrackedAssetStatus;
  condition?: ItemCondition;
  warehouseId?: string;
  categoryId?: string;
  rfidTagType?: RfidTagType;
};

const assetInclude = {
  item: {
    select: {
      id: true,
      name: true,
      reference: true,
      photoUrl: true,
      emoji: true,
      technicalParams: true,
      defaultRfidTagType: true,
      categoryId: true,
      category: { select: { id: true, name: true, code: true } },
    },
  },
  itemVariant: { select: { id: true, reference: true, label: true } },
  currentWarehouse: { select: { id: true, name: true, code: true, city: true } },
  custodian: { select: { id: true, fullName: true } },
} satisfies Prisma.TrackedAssetInclude;

export async function listTrackedAssets(organizationId: string, filters?: TrackedAssetListFilters) {
  const q = filters?.q?.trim();
  return prisma.trackedAsset.findMany({
    where: {
      organizationId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.condition ? { condition: filters.condition } : {}),
      ...(filters?.warehouseId ? { currentWarehouseId: filters.warehouseId } : {}),
      ...(filters?.rfidTagType ? { rfidTagType: filters.rfidTagType } : {}),
      ...(filters?.categoryId ? { item: { categoryId: filters.categoryId } } : {}),
      ...(q
        ? {
            OR: [
              { tagCode: { contains: q, mode: "insensitive" } },
              { item: { name: { contains: q, mode: "insensitive" } } },
              { item: { reference: { contains: q, mode: "insensitive" } } },
              { item: { technicalParams: { contains: q, mode: "insensitive" } } },
              { item: { category: { name: { contains: q, mode: "insensitive" } } } },
              { item: { category: { code: { contains: q, mode: "insensitive" } } } },
              { currentWarehouse: { name: { contains: q, mode: "insensitive" } } },
              { currentWarehouse: { code: { contains: q, mode: "insensitive" } } },
              { currentWarehouse: { city: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: assetInclude,
    orderBy: { tagCode: "asc" },
    take: 500,
  });
}

export async function getTrackedAssetDetail(organizationId: string, id: string) {
  const asset = await prisma.trackedAsset.findFirst({
    where: { id, organizationId },
    include: assetInclude,
  });
  if (!asset) {
    throw new RfidDbError("Unité RFID introuvable", 404);
  }

  const [eventSite, documentHistory, custodyHistory] = await Promise.all([
    asset.currentEventId
      ? prisma.event.findFirst({
          where: { id: asset.currentEventId, organizationId },
          select: { id: true, name: true, location: true, clientName: true },
        })
      : null,
    prisma.documentLine.findMany({
      where: { trackedAssetId: id },
      include: {
        stockDocument: {
          select: {
            id: true,
            documentNumber: true,
            kind: true,
            status: true,
            signedAt: true,
            createdAt: true,
          },
        },
      },
      take: 40,
    }),
    prisma.responsibilityLog.findMany({
      where: { trackedAssetId: id, organizationId },
      include: {
        event: { select: { name: true } },
        stockDocument: { select: { documentNumber: true, kind: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
  ]);

  return {
    ...asset,
    currentEvent: eventSite,
    movementHistory: documentHistory.map((line) => ({
      id: line.id,
      at: line.stockDocument.signedAt ?? line.stockDocument.createdAt,
      documentNumber: line.stockDocument.documentNumber,
      kind: line.stockDocument.kind,
      status: line.stockDocument.status,
      expectedQty: line.expectedQty,
      scannedQty: line.scannedQty,
      receivedQty: line.receivedQty,
    })),
    custodyHistory: custodyHistory.map((log) => ({
      id: log.id,
      phase: log.phase,
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      eventName: log.event?.name,
      documentNumber: log.stockDocument?.documentNumber,
      documentKind: log.stockDocument?.kind,
    })),
  };
}

export type RfidCatalogFilters = {
  q?: string;
  categoryId?: string;
  defaultRfidTagType?: RfidTagType;
};

export async function listRfidCatalog(organizationId: string, filters?: RfidCatalogFilters) {
  const q = filters?.q?.trim();
  const items = await prisma.item.findMany({
    where: {
      organizationId,
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.defaultRfidTagType ? { defaultRfidTagType: filters.defaultRfidTagType } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
              { technicalParams: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
              { category: { code: { contains: q, mode: "insensitive" } } },
              { trackedAssets: { some: { tagCode: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true, code: true } },
      trackedAssets: {
        select: {
          id: true,
          tagCode: true,
          status: true,
          condition: true,
          rfidTagType: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    reference: item.reference,
    photoUrl: item.photoUrl,
    emoji: item.emoji,
    technicalParams: item.technicalParams,
    defaultRfidTagType: item.defaultRfidTagType,
    category: item.category,
    unitCount: item.trackedAssets.length,
    taggedUnits: item.trackedAssets,
    totalQuantity: item.totalQuantity,
  }));
}

export type InventorySampleResult = {
  scanned: number;
  matched: Array<{ tagCode: string; itemName: string; status: string; condition: string }>;
  unknownTags: string[];
  quarantineHits: string[];
  missingInSample: Array<{ tagCode: string; itemName: string }>;
  sampleCoveragePct: number;
};

/** Inventaire par sondage : compare les tags scannés au parc attendu (entrepôt ou global). */
export async function runInventorySample(
  organizationId: string,
  raw: unknown,
): Promise<InventorySampleResult> {
  const payload = z
    .object({
      tagCodes: z.array(z.string().min(3)).min(1).max(500),
      warehouseId: objectId.optional(),
      expectedPoolSize: z.number().int().positive().max(5000).optional(),
    })
    .parse(raw);

  const normalized = [...new Set(payload.tagCodes.map((t) => t.trim().toUpperCase()))];

  const pool = await prisma.trackedAsset.findMany({
    where: {
      organizationId,
      status: { not: TrackedAssetStatus.SCRAPPED },
      ...(payload.warehouseId ? { currentWarehouseId: payload.warehouseId } : {}),
    },
    include: { item: { select: { name: true } } },
  });

  const byTag = new Map(pool.map((a) => [a.tagCode, a]));
  const scannedSet = new Set(normalized);

  const matched: InventorySampleResult["matched"] = [];
  const unknownTags: string[] = [];
  const quarantineHits: string[] = [];

  for (const tag of normalized) {
    const asset = byTag.get(tag);
    if (!asset) {
      unknownTags.push(tag);
      continue;
    }
    matched.push({
      tagCode: tag,
      itemName: asset.item.name,
      status: asset.status,
      condition: asset.condition,
    });
    if (asset.status === TrackedAssetStatus.QUARANTINE || conditionRequiresQuarantine(asset.condition)) {
      quarantineHits.push(tag);
    }
  }

  const missingInSample = pool
    .filter((a) => !scannedSet.has(a.tagCode))
    .slice(0, 50)
    .map((a) => ({ tagCode: a.tagCode, itemName: a.item.name }));

  const poolSize = payload.expectedPoolSize ?? pool.length;
  const sampleCoveragePct =
    poolSize > 0 ? Math.min(100, Math.round((matched.length / poolSize) * 100)) : 0;

  return {
    scanned: normalized.length,
    matched,
    unknownTags,
    quarantineHits,
    missingInSample,
    sampleCoveragePct,
  };
}

export async function createTrackedAsset(organizationId: string, raw: unknown) {
  const payload = createTrackedAssetSchema.parse(raw);
  const existing = await prisma.trackedAsset.findUnique({
    where: {
      organizationId_tagCode: {
        organizationId,
        tagCode: payload.tagCode.toUpperCase(),
      },
    },
  });
  if (existing) {
    throw new RfidDbError("Ce tag existe déjà", 409);
  }

  const item = await prisma.item.findFirst({
    where: { id: payload.itemId, organizationId },
  });
  if (!item) {
    throw new RfidDbError("Article introuvable", 404);
  }

  const condition = payload.condition ?? item.condition ?? ItemCondition.GOOD;
  const status = resolveAssetStatusFromCondition(condition, TrackedAssetStatus.AVAILABLE);

  return prisma.trackedAsset.create({
    data: {
      organizationId,
      tagCode: payload.tagCode.toUpperCase(),
      itemId: payload.itemId,
      itemVariantId: payload.itemVariantId,
      rfidTagType: payload.rfidTagType,
      condition,
      currentWarehouseId: payload.currentWarehouseId,
      photoUrl: payload.photoUrl || item.photoUrl || null,
      notes: payload.notes,
      status,
    },
    include: assetInclude,
  });
}

export async function updateTrackedAsset(organizationId: string, id: string, raw: unknown) {
  const payload = updateTrackedAssetSchema.parse(raw);
  const asset = await prisma.trackedAsset.findFirst({ where: { id, organizationId } });
  if (!asset) {
    throw new RfidDbError("Tag introuvable", 404);
  }

  const nextCondition = payload.condition ?? asset.condition;
  let nextStatus = payload.status ?? asset.status;
  if (payload.condition !== undefined && payload.status === undefined) {
    nextStatus = resolveAssetStatusFromCondition(nextCondition, asset.status);
  }
  if (payload.condition !== undefined && conditionRequiresQuarantine(nextCondition)) {
    nextStatus = TrackedAssetStatus.QUARANTINE;
  }

  return prisma.trackedAsset.update({
    where: { id },
    data: {
      ...(payload.rfidTagType ? { rfidTagType: payload.rfidTagType } : {}),
      condition: nextCondition,
      status: nextStatus,
      ...(payload.currentWarehouseId !== undefined
        ? { currentWarehouseId: payload.currentWarehouseId }
        : {}),
      ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl || null } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.custodianUserId !== undefined
        ? { custodianUserId: payload.custodianUserId }
        : {}),
    },
    include: assetInclude,
  });
}

export async function suggestNextTagCode(organizationId: string, categoryCode: string) {
  const prefix = `TAG-${categoryCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GEN"}`;
  const last = await prisma.trackedAsset.findFirst({
    where: { organizationId, tagCode: { startsWith: prefix } },
    orderBy: { tagCode: "desc" },
  });
  let seq = 1;
  if (last?.tagCode) {
    const part = last.tagCode.split("-").pop();
    const n = Number.parseInt(part ?? "0", 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
