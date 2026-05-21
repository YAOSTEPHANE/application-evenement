import type { StorageZone } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  normalizeStorageZonePayload,
  storageZoneCreateSchema,
  storageZoneUpdateSchema,
  zoneAccessToUi,
  zoneTypeToUi,
  type StorageZoneCreateInput,
  type StorageZoneUpdateInput,
} from "@/lib/warehouse-zone-helpers";
import { WarehouseDbError } from "@/lib/warehouse-db";

export class StorageZoneDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StorageZoneDbError";
  }
}

export function serializeStorageZone(row: StorageZone) {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    name: row.name,
    code: row.code,
    zoneType: row.zoneType,
    zoneTypeLabel: zoneTypeToUi(row.zoneType),
    locationLabel: row.locationLabel,
    totalCapacity: row.totalCapacity,
    capacityUnit: row.capacityUnit,
    accessType: row.accessType,
    accessTypeLabel: zoneAccessToUi(row.accessType),
    notes: row.notes,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertWarehouse(organizationId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
    select: { id: true, code: true },
  });
  if (!warehouse) {
    throw new StorageZoneDbError("Entrepôt introuvable", 404);
  }
  return warehouse;
}

async function assertUniqueZoneCode(warehouseId: string, code: string, excludeId?: string) {
  const existing = await prisma.storageZone.findFirst({
    where: {
      warehouseId,
      code,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new StorageZoneDbError(`Le code zone « ${code} » existe déjà dans cet entrepôt.`, 409);
  }
}

export async function listStorageZones(organizationId: string, warehouseId: string) {
  await assertWarehouse(organizationId, warehouseId);
  const rows = await prisma.storageZone.findMany({
    where: { warehouseId, organizationId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { _count: { select: { shelvingNodes: true, storageLocations: true } } },
  });
  return rows.map((row) => ({
    ...serializeStorageZone(row),
    shelvingCount: row._count.shelvingNodes,
    locationCount: row._count.storageLocations,
  }));
}

export async function getStorageZone(organizationId: string, warehouseId: string, zoneId: string) {
  const row = await prisma.storageZone.findFirst({
    where: { id: zoneId, warehouseId, organizationId },
  });
  if (!row) {
    throw new StorageZoneDbError("Zone introuvable", 404);
  }
  return serializeStorageZone(row);
}

export async function createStorageZone(
  organizationId: string,
  warehouseId: string,
  raw: unknown,
) {
  await assertWarehouse(organizationId, warehouseId);
  const payload: StorageZoneCreateInput = storageZoneCreateSchema.parse(raw);
  const data = normalizeStorageZonePayload(payload);
  if (!data.name || !data.code) {
    throw new StorageZoneDbError("Nom et code requis", 400);
  }
  await assertUniqueZoneCode(warehouseId, data.code);

  const row = await prisma.storageZone.create({
    data: {
      ...data,
      warehouseId,
      organizationId,
    },
  });
  return serializeStorageZone(row);
}

export async function updateStorageZone(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
  raw: unknown,
) {
  const payload: StorageZoneUpdateInput = storageZoneUpdateSchema.parse(raw);
  const existing = await prisma.storageZone.findFirst({
    where: { id: zoneId, warehouseId, organizationId },
  });
  if (!existing) {
    throw new StorageZoneDbError("Zone introuvable", 404);
  }

  const merged = normalizeStorageZonePayload({
    name: payload.name ?? existing.name,
    code: payload.code ?? existing.code,
    zoneType: payload.zoneType ?? existing.zoneType,
    locationLabel:
      payload.locationLabel !== undefined ? payload.locationLabel : existing.locationLabel,
    totalCapacity:
      payload.totalCapacity !== undefined ? payload.totalCapacity : existing.totalCapacity,
    capacityUnit:
      payload.capacityUnit !== undefined ? payload.capacityUnit : existing.capacityUnit,
    accessType: payload.accessType ?? existing.accessType,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    active: payload.active !== undefined ? payload.active : existing.active,
    sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
  });

  if (merged.code !== existing.code) {
    await assertUniqueZoneCode(warehouseId, merged.code, zoneId);
  }

  const row = await prisma.storageZone.update({
    where: { id: zoneId },
    data: merged,
  });
  return serializeStorageZone(row);
}

export async function deleteStorageZone(
  organizationId: string,
  warehouseId: string,
  zoneId: string,
) {
  const existing = await prisma.storageZone.findFirst({
    where: { id: zoneId, warehouseId, organizationId },
  });
  if (!existing) {
    throw new StorageZoneDbError("Zone introuvable", 404);
  }
  await prisma.storageZone.delete({ where: { id: zoneId } });
}

export { WarehouseDbError };
