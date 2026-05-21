import type { ShelvingNode } from "@prisma/client";
import { ShelvingLevel, StorageZoneType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildCoordinate,
  childLevelFor,
  formatDimensions,
  normalizeShelvingPayload,
  shelvingCreateSchema,
  shelvingMaterialToUi,
  shelvingUpdateSchema,
  shelvingLevelToUi,
  type ShelvingCreateInput,
  type ShelvingUpdateInput,
} from "@/lib/shelving-helpers";
import { StorageZoneDbError } from "@/lib/warehouse-zone-db";

export class ShelvingDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ShelvingDbError";
  }
}

export function serializeShelvingNode(row: ShelvingNode) {
  return {
    id: row.id,
    storageZoneId: row.storageZoneId,
    parentId: row.parentId,
    level: row.level,
    levelLabel: shelvingLevelToUi(row.level),
    code: row.code,
    label: row.label,
    coordinate: row.coordinate,
    materialType: row.materialType,
    materialTypeLabel: row.materialType ? shelvingMaterialToUi(row.materialType) : null,
    weightCapacityKg: row.weightCapacityKg,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    depthCm: row.depthCm,
    dimensionsLabel: formatDimensions(row.widthCm, row.heightCm, row.depthCm),
    notes: row.notes,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertShelvingZone(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
) {
  const zone = await prisma.storageZone.findFirst({
    where: { id: zoneId, warehouseId, organizationId },
    select: { id: true, zoneType: true },
  });
  if (!zone) {
    throw new ShelvingDbError("Zone introuvable", 404);
  }
  if (zone.zoneType !== StorageZoneType.SHELVING) {
    throw new ShelvingDbError("Les rayonnages ne sont gérés que dans une zone de type Rayonnage.", 400);
  }
  return zone;
}

async function getParentNode(storageZoneId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return null;
  }
  const parent = await prisma.shelvingNode.findFirst({
    where: { id: parentId, storageZoneId },
  });
  if (!parent) {
    throw new ShelvingDbError("Nœud parent introuvable", 404);
  }
  return parent;
}

function assertLevelChain(parent: ShelvingNode | null, level: ShelvingLevel) {
  const expected = childLevelFor(parent?.level ?? null);
  if (level !== expected) {
    throw new ShelvingDbError(
      parent
        ? `Le niveau attendu sous « ${parent.coordinate} » est « ${shelvingLevelToUi(expected)} ».`
        : "Le premier niveau doit être une allée.",
      400,
    );
  }
}

async function assertUniqueCoordinate(storageZoneId: string, coordinate: string, excludeId?: string) {
  const existing = await prisma.shelvingNode.findFirst({
    where: {
      storageZoneId,
      coordinate,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ShelvingDbError(`La coordonnée « ${coordinate} » existe déjà dans cette zone.`, 409);
  }
}

export async function listShelvingNodes(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
) {
  await assertShelvingZone(organizationId, warehouseId, zoneId);
  const rows = await prisma.shelvingNode.findMany({
    where: { storageZoneId: zoneId, organizationId },
    orderBy: [{ sortOrder: "asc" }, { coordinate: "asc" }],
  });
  return rows.map(serializeShelvingNode);
}

export async function getShelvingNode(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  nodeId: string,
) {
  await assertShelvingZone(organizationId, warehouseId, zoneId);
  const row = await prisma.shelvingNode.findFirst({
    where: { id: nodeId, storageZoneId: zoneId, organizationId },
  });
  if (!row) {
    throw new ShelvingDbError("Élément de rayonnage introuvable", 404);
  }
  return serializeShelvingNode(row);
}

export async function createShelvingNode(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  raw: unknown,
) {
  await assertShelvingZone(organizationId, warehouseId, zoneId);
  const payload: ShelvingCreateInput = shelvingCreateSchema.parse(raw);
  const data = normalizeShelvingPayload(payload);
  const parent = await getParentNode(zoneId, data.parentId);
  assertLevelChain(parent, data.level);

  if (data.level === ShelvingLevel.RACK && !data.materialType) {
    throw new ShelvingDbError("Le type de rayonnage (métal, bois, plastique) est requis pour un rack.", 400);
  }
  if (data.level === ShelvingLevel.BIN && data.weightCapacityKg == null) {
    throw new ShelvingDbError("La capacité de poids est requise pour un emplacement.", 400);
  }

  const coordinate = buildCoordinate(parent?.coordinate ?? null, data.code);
  await assertUniqueCoordinate(zoneId, coordinate);

  const row = await prisma.shelvingNode.create({
    data: {
      storageZoneId: zoneId,
      organizationId,
      parentId: parent?.id ?? null,
      level: data.level,
      code: data.code,
      label: data.label,
      coordinate,
      materialType: data.level === ShelvingLevel.RACK ? data.materialType : null,
      weightCapacityKg: data.level === ShelvingLevel.BIN ? data.weightCapacityKg : null,
      widthCm: data.level === ShelvingLevel.BIN ? data.widthCm : null,
      heightCm: data.level === ShelvingLevel.BIN ? data.heightCm : null,
      depthCm: data.level === ShelvingLevel.BIN ? data.depthCm : null,
      notes: data.notes,
      active: data.active,
      sortOrder: data.sortOrder,
    },
  });
  return serializeShelvingNode(row);
}

export async function updateShelvingNode(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  nodeId: string,
  raw: unknown,
) {
  await assertShelvingZone(organizationId, warehouseId, zoneId);
  const payload: ShelvingUpdateInput = shelvingUpdateSchema.parse(raw);
  const existing = await prisma.shelvingNode.findFirst({
    where: { id: nodeId, storageZoneId: zoneId, organizationId },
  });
  if (!existing) {
    throw new ShelvingDbError("Élément de rayonnage introuvable", 404);
  }

  const parentId =
    payload.parentId !== undefined ? payload.parentId : existing.parentId;
  const parent = await getParentNode(zoneId, parentId);
  const level = payload.level ?? existing.level;
  assertLevelChain(parent, level);

  const code = payload.code?.trim().toUpperCase() ?? existing.code;
  const coordinate = buildCoordinate(parent?.coordinate ?? null, code);

  if (coordinate !== existing.coordinate) {
    const childCount = await prisma.shelvingNode.count({
      where: { storageZoneId: zoneId, coordinate: { startsWith: `${existing.coordinate}-` } },
    });
    if (childCount > 0) {
      throw new ShelvingDbError(
        "Impossible de modifier la coordonnée : des éléments enfants existent. Supprimez-les d'abord.",
        409,
      );
    }
    await assertUniqueCoordinate(zoneId, coordinate, nodeId);
  }

  const merged = normalizeShelvingPayload({
    parentId,
    level,
    code,
    label: payload.label !== undefined ? payload.label : existing.label,
    materialType:
      payload.materialType !== undefined ? payload.materialType : existing.materialType,
    weightCapacityKg:
      payload.weightCapacityKg !== undefined
        ? payload.weightCapacityKg
        : existing.weightCapacityKg,
    widthCm: payload.widthCm !== undefined ? payload.widthCm : existing.widthCm,
    heightCm: payload.heightCm !== undefined ? payload.heightCm : existing.heightCm,
    depthCm: payload.depthCm !== undefined ? payload.depthCm : existing.depthCm,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    active: payload.active !== undefined ? payload.active : existing.active,
    sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
  });

  const row = await prisma.shelvingNode.update({
    where: { id: nodeId },
    data: {
      parentId: parent?.id ?? null,
      level: merged.level,
      code: merged.code,
      label: merged.label,
      coordinate,
      materialType: merged.level === ShelvingLevel.RACK ? merged.materialType : null,
      weightCapacityKg: merged.level === ShelvingLevel.BIN ? merged.weightCapacityKg : null,
      widthCm: merged.level === ShelvingLevel.BIN ? merged.widthCm : null,
      heightCm: merged.level === ShelvingLevel.BIN ? merged.heightCm : null,
      depthCm: merged.level === ShelvingLevel.BIN ? merged.depthCm : null,
      notes: merged.notes,
      active: merged.active,
      sortOrder: merged.sortOrder,
    },
  });
  return serializeShelvingNode(row);
}

export async function deleteShelvingNode(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  nodeId: string,
) {
  await assertShelvingZone(organizationId, warehouseId, zoneId);
  const existing = await prisma.shelvingNode.findFirst({
    where: { id: nodeId, storageZoneId: zoneId, organizationId },
  });
  if (!existing) {
    throw new ShelvingDbError("Élément de rayonnage introuvable", 404);
  }
  const childCount = await prisma.shelvingNode.count({
    where: { parentId: nodeId },
  });
  if (childCount > 0) {
    throw new ShelvingDbError("Supprimez d'abord les éléments enfants (rack, étagère, emplacement).", 409);
  }
  await prisma.shelvingNode.delete({ where: { id: nodeId } });
}

export { StorageZoneDbError };
