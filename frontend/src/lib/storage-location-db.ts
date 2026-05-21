import type { StorageLocation } from "@prisma/client";
import { ShelvingLevel } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  fillStateToUi,
  normalizeStorageLocationPayload,
  storageLocationCreateSchema,
  storageLocationUpdateSchema,
  type StorageLocationCreateInput,
  type StorageLocationUpdateInput,
} from "@/lib/storage-location-helpers";

export class StorageLocationDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StorageLocationDbError";
  }
}

export function serializeStorageLocation(row: StorageLocation) {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    storageZoneId: row.storageZoneId,
    shelvingNodeId: row.shelvingNodeId,
    code: row.code,
    label: row.label,
    hierarchyCoordinate: row.hierarchyCoordinate,
    latitude: row.latitude,
    longitude: row.longitude,
    maxWeightKg: row.maxWeightKg,
    maxVolumeM3: row.maxVolumeM3,
    maxItemCount: row.maxItemCount,
    fillState: row.fillState,
    fillStateLabel: fillStateToUi(row.fillState),
    minTempC: row.minTempC,
    maxTempC: row.maxTempC,
    humidityPercent: row.humidityPercent,
    accessHeightCm: row.accessHeightCm,
    accessWidthCm: row.accessWidthCm,
    specialConditions: row.specialConditions,
    notes: row.notes,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertZone(organizationId: string, warehouseId: string, zoneId: string) {
  const zone = await prisma.storageZone.findFirst({
    where: { id: zoneId, warehouseId, organizationId },
    select: { id: true },
  });
  if (!zone) {
    throw new StorageLocationDbError("Zone introuvable", 404);
  }
}

async function assertUniqueCode(organizationId: string, code: string, excludeId?: string) {
  const existing = await prisma.storageLocation.findFirst({
    where: {
      organizationId,
      code,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new StorageLocationDbError(`Le code emplacement « ${code} » existe déjà.`, 409);
  }
}

async function assertShelvingNodeLink(
  storageZoneId: string,
  shelvingNodeId: string | null | undefined,
  excludeLocationId?: string,
) {
  if (!shelvingNodeId) {
    return null;
  }
  const node = await prisma.shelvingNode.findFirst({
    where: { id: shelvingNodeId, storageZoneId },
  });
  if (!node) {
    throw new StorageLocationDbError("Nœud de rayonnage introuvable dans cette zone", 404);
  }
  if (node.level !== ShelvingLevel.BIN) {
    throw new StorageLocationDbError("Seul un emplacement de rayonnage (niveau BIN) peut être lié.", 400);
  }
  const linked = await prisma.storageLocation.findFirst({
    where: {
      shelvingNodeId,
      ...(excludeLocationId ? { NOT: { id: excludeLocationId } } : {}),
    },
    select: { id: true },
  });
  if (linked) {
    throw new StorageLocationDbError("Ce nœud de rayonnage est déjà rattaché à un emplacement.", 409);
  }
  return node;
}

export async function listStorageLocations(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
) {
  await assertZone(organizationId, warehouseId, zoneId);
  const rows = await prisma.storageLocation.findMany({
    where: { storageZoneId: zoneId, organizationId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map(serializeStorageLocation);
}

export async function getStorageLocation(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  locationId: string,
) {
  await assertZone(organizationId, warehouseId, zoneId);
  const row = await prisma.storageLocation.findFirst({
    where: { id: locationId, storageZoneId: zoneId, organizationId },
  });
  if (!row) {
    throw new StorageLocationDbError("Emplacement introuvable", 404);
  }
  return serializeStorageLocation(row);
}

export async function createStorageLocation(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  raw: unknown,
) {
  await assertZone(organizationId, warehouseId, zoneId);
  const payload: StorageLocationCreateInput = storageLocationCreateSchema.parse(raw);
  const data = normalizeStorageLocationPayload(payload);
  if (!data.code) {
    throw new StorageLocationDbError("Code emplacement requis", 400);
  }
  await assertUniqueCode(organizationId, data.code);
  const node = await assertShelvingNodeLink(zoneId, data.shelvingNodeId);
  const hierarchyCoordinate = data.hierarchyCoordinate ?? node?.coordinate ?? null;

  const row = await prisma.storageLocation.create({
    data: {
      organizationId,
      warehouseId,
      storageZoneId: zoneId,
      shelvingNodeId: node?.id ?? null,
      code: data.code,
      label: data.label,
      hierarchyCoordinate,
      latitude: data.latitude,
      longitude: data.longitude,
      maxWeightKg: data.maxWeightKg,
      maxVolumeM3: data.maxVolumeM3,
      maxItemCount: data.maxItemCount,
      fillState: data.fillState,
      minTempC: data.minTempC,
      maxTempC: data.maxTempC,
      humidityPercent: data.humidityPercent,
      accessHeightCm: data.accessHeightCm,
      accessWidthCm: data.accessWidthCm,
      specialConditions: data.specialConditions,
      notes: data.notes,
      active: data.active,
      sortOrder: data.sortOrder,
    },
  });
  return serializeStorageLocation(row);
}

export async function updateStorageLocation(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  locationId: string,
  raw: unknown,
) {
  await assertZone(organizationId, warehouseId, zoneId);
  const payload: StorageLocationUpdateInput = storageLocationUpdateSchema.parse(raw);
  const existing = await prisma.storageLocation.findFirst({
    where: { id: locationId, storageZoneId: zoneId, organizationId },
  });
  if (!existing) {
    throw new StorageLocationDbError("Emplacement introuvable", 404);
  }

  const shelvingNodeId =
    payload.shelvingNodeId !== undefined ? payload.shelvingNodeId : existing.shelvingNodeId;
  const node = await assertShelvingNodeLink(zoneId, shelvingNodeId, locationId);

  const merged = normalizeStorageLocationPayload({
    code: payload.code ?? existing.code,
    label: payload.label !== undefined ? payload.label : existing.label,
    shelvingNodeId,
    hierarchyCoordinate:
      payload.hierarchyCoordinate !== undefined
        ? payload.hierarchyCoordinate
        : existing.hierarchyCoordinate ?? node?.coordinate ?? null,
    latitude: payload.latitude !== undefined ? payload.latitude : existing.latitude,
    longitude: payload.longitude !== undefined ? payload.longitude : existing.longitude,
    maxWeightKg: payload.maxWeightKg !== undefined ? payload.maxWeightKg : existing.maxWeightKg,
    maxVolumeM3: payload.maxVolumeM3 !== undefined ? payload.maxVolumeM3 : existing.maxVolumeM3,
    maxItemCount:
      payload.maxItemCount !== undefined ? payload.maxItemCount : existing.maxItemCount,
    fillState: payload.fillState ?? existing.fillState,
    minTempC: payload.minTempC !== undefined ? payload.minTempC : existing.minTempC,
    maxTempC: payload.maxTempC !== undefined ? payload.maxTempC : existing.maxTempC,
    humidityPercent:
      payload.humidityPercent !== undefined ? payload.humidityPercent : existing.humidityPercent,
    accessHeightCm:
      payload.accessHeightCm !== undefined ? payload.accessHeightCm : existing.accessHeightCm,
    accessWidthCm:
      payload.accessWidthCm !== undefined ? payload.accessWidthCm : existing.accessWidthCm,
    specialConditions:
      payload.specialConditions !== undefined
        ? payload.specialConditions
        : existing.specialConditions,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    active: payload.active !== undefined ? payload.active : existing.active,
    sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
  });

  if (merged.code !== existing.code) {
    await assertUniqueCode(organizationId, merged.code, locationId);
  }

  const row = await prisma.storageLocation.update({
    where: { id: locationId },
    data: {
      shelvingNodeId: node?.id ?? null,
      code: merged.code,
      label: merged.label,
      hierarchyCoordinate: merged.hierarchyCoordinate,
      latitude: merged.latitude,
      longitude: merged.longitude,
      maxWeightKg: merged.maxWeightKg,
      maxVolumeM3: merged.maxVolumeM3,
      maxItemCount: merged.maxItemCount,
      fillState: merged.fillState,
      minTempC: merged.minTempC,
      maxTempC: merged.maxTempC,
      humidityPercent: merged.humidityPercent,
      accessHeightCm: merged.accessHeightCm,
      accessWidthCm: merged.accessWidthCm,
      specialConditions: merged.specialConditions,
      notes: merged.notes,
      active: merged.active,
      sortOrder: merged.sortOrder,
    },
  });
  return serializeStorageLocation(row);
}

export async function deleteStorageLocation(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  locationId: string,
) {
  await assertZone(organizationId, warehouseId, zoneId);
  const existing = await prisma.storageLocation.findFirst({
    where: { id: locationId, storageZoneId: zoneId, organizationId },
  });
  if (!existing) {
    throw new StorageLocationDbError("Emplacement introuvable", 404);
  }
  await prisma.storageLocation.delete({ where: { id: locationId } });
}
