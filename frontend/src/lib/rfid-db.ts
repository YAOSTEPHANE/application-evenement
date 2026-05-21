import {
  ItemCondition,
  RfidTagType,
  TrackedAssetStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { cdcPhaseTitle, cdcHolderRoleLabel } from "@/lib/cdc-responsibility-cycle";
import { prisma } from "@/lib/prisma";
import { resolveCurrentCustodian } from "@/lib/responsibility-db";
import { conditionRequiresQuarantine, resolveAssetStatusFromCondition } from "@/lib/rfid-quarantine";
import {
  assertTagMatchesCategory,
  assertValidTagCodeFormat,
  categoryCodeToTagSegment,
  formatTagCode,
  tagCodePrefixForCategory,
} from "@/lib/tag-nomenclature";

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
  .transform((s) => assertValidTagCodeFormat(s))
  .refine((s) => /^TAG-[A-Z0-9]{4}-\d{4}$/.test(s), "Format attendu : TAG-XXXX-YYYY");

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
  /** Modifiable uniquement tant que la codification n’est pas validée */
  tagCode: tagCodeSchema.optional(),
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

  const currentCustodian = await resolveCurrentCustodian(organizationId, {
    trackedAssetId: id,
  });

  const custodyHolderIds = [...new Set(custodyHistory.map((l) => l.holderUserId))];
  const custodyHolders = await prisma.user.findMany({
    where: { id: { in: custodyHolderIds }, organizationId },
    select: { id: true, fullName: true },
  });
  const custodyHolderNames = new Map(custodyHolders.map((u) => [u.id, u.fullName]));

  return {
    ...asset,
    currentEvent: eventSite,
    currentCustodian,
    movementHistory: documentHistory
      .map((line) => ({
        id: line.id,
        at: line.stockDocument.signedAt ?? line.stockDocument.createdAt,
        documentNumber: line.stockDocument.documentNumber,
        kind: line.stockDocument.kind,
        status: line.stockDocument.status,
        expectedQty: line.expectedQty,
        scannedQty: line.scannedQty,
        receivedQty: line.receivedQty,
      }))
      .sort((a, b) => b.at.getTime() - a.at.getTime()),
    custodyHistory: custodyHistory.map((log) => ({
      id: log.id,
      phase: log.phase,
      phaseTitle: cdcPhaseTitle(log.phase),
      holderRole: cdcHolderRoleLabel(log.phase),
      holderName: custodyHolderNames.get(log.holderUserId) ?? null,
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
        tagCode: payload.tagCode,
      },
    },
  });
  if (existing) {
    throw new RfidDbError("Ce tag existe déjà", 409);
  }

  const item = await prisma.item.findFirst({
    where: { id: payload.itemId, organizationId },
    include: { category: { select: { id: true, code: true } } },
  });
  if (!item) {
    throw new RfidDbError("Article introuvable", 404);
  }

  try {
    assertTagMatchesCategory(payload.tagCode, item.category.code);
  } catch (e) {
    throw new RfidDbError(e instanceof Error ? e.message : "Tag incompatible avec la catégorie", 400);
  }

  const condition = payload.condition ?? item.condition ?? ItemCondition.GOOD;
  const status = resolveAssetStatusFromCondition(condition, TrackedAssetStatus.AVAILABLE);

  const created = await prisma.trackedAsset.create({
    data: {
      organizationId,
      tagCode: payload.tagCode,
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

  const seqPart = payload.tagCode.split("-").pop();
  const seqNum = Number.parseInt(seqPart ?? "0", 10);
  if (Number.isFinite(seqNum)) {
    await syncTagSequenceFloor(organizationId, item.category.code, seqNum);
  }

  return created;
}

export async function updateTrackedAsset(organizationId: string, id: string, raw: unknown) {
  const payload = updateTrackedAssetSchema.parse(raw);
  const asset = await prisma.trackedAsset.findFirst({
    where: { id, organizationId },
    include: { item: { include: { category: { select: { code: true } } } } },
  });
  if (!asset) {
    throw new RfidDbError("Tag introuvable", 404);
  }

  if (payload.tagCode !== undefined) {
    if (asset.tagCodeValidatedAt) {
      throw new RfidDbError("Codification validée : l’identifiant tag est immuable", 409);
    }
    try {
      assertTagMatchesCategory(payload.tagCode, asset.item.category.code);
    } catch (e) {
      throw new RfidDbError(e instanceof Error ? e.message : "Tag incompatible", 400);
    }
    const clash = await prisma.trackedAsset.findFirst({
      where: {
        organizationId,
        tagCode: payload.tagCode,
        id: { not: id },
      },
    });
    if (clash) {
      throw new RfidDbError("Ce tag existe déjà", 409);
    }
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
      ...(payload.tagCode ? { tagCode: payload.tagCode } : {}),
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

async function syncTagSequenceFloor(
  organizationId: string,
  categoryCode: string,
  sequence: number,
): Promise<void> {
  const segment = categoryCodeToTagSegment(categoryCode);
  const existing = await prisma.tagCodeSequence.findUnique({
    where: {
      organizationId_categorySegment: { organizationId, categorySegment: segment },
    },
  });
  const nextFloor = Math.max(existing?.lastNumber ?? 0, sequence);
  await prisma.tagCodeSequence.upsert({
    where: {
      organizationId_categorySegment: { organizationId, categorySegment: segment },
    },
    create: { organizationId, categorySegment: segment, lastNumber: nextFloor },
    update: { lastNumber: nextFloor },
  });
}

async function peekNextTagSequence(organizationId: string, categoryCode: string): Promise<number> {
  const segment = categoryCodeToTagSegment(categoryCode);
  const prefix = tagCodePrefixForCategory(categoryCode);
  const [seqRow, lastAsset] = await Promise.all([
    prisma.tagCodeSequence.findUnique({
      where: {
        organizationId_categorySegment: { organizationId, categorySegment: segment },
      },
    }),
    prisma.trackedAsset.findFirst({
      where: { organizationId, tagCode: { startsWith: prefix } },
      orderBy: { tagCode: "desc" },
    }),
  ]);
  let maxFromAssets = 0;
  if (lastAsset?.tagCode) {
    const part = lastAsset.tagCode.split("-").pop();
    const n = Number.parseInt(part ?? "0", 10);
    if (Number.isFinite(n)) {
      maxFromAssets = n;
    }
  }
  return Math.max(seqRow?.lastNumber ?? 0, maxFromAssets) + 1;
}

export async function suggestNextTagCode(organizationId: string, categoryCode: string) {
  const seq = await peekNextTagSequence(organizationId, categoryCode);
  return formatTagCode(categoryCode, seq);
}

/** Valide la codification : tag immuable + verrouillage du code catégorie. */
export async function validateTrackedAssetTagCode(
  organizationId: string,
  assetId: string,
  userId: string,
) {
  const asset = await prisma.trackedAsset.findFirst({
    where: { id: assetId, organizationId },
    include: { item: { include: { category: true } } },
  });
  if (!asset) {
    throw new RfidDbError("Unité RFID introuvable", 404);
  }
  if (asset.tagCodeValidatedAt) {
    throw new RfidDbError("Cette codification est déjà validée", 409);
  }

  try {
    assertTagMatchesCategory(asset.tagCode, asset.item.category.code);
  } catch (e) {
    throw new RfidDbError(e instanceof Error ? e.message : "Format tag invalide", 400);
  }

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.trackedAsset.update({
      where: { id: assetId },
      data: {
        tagCodeValidatedAt: now,
        tagCodeValidatedByUserId: userId,
      },
      include: assetInclude,
    }),
    prisma.category.update({
      where: { id: asset.item.categoryId },
      data: { codeLockedAt: now },
    }),
  ]);

  return updated;
}

export function describeTagNomenclature(categoryCode: string) {
  const segment = categoryCodeToTagSegment(categoryCode);
  return {
    pattern: "TAG-XXXX-YYYY",
    categoryCode,
    categorySegment: segment,
    prefix: tagCodePrefixForCategory(categoryCode),
    example: formatTagCode(categoryCode, 1),
  };
}
