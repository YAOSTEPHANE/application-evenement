import type { Warehouse } from "@prisma/client";

import {
  normalizeWarehousePayload,
  warehouseCreateSchema,
  warehouseKindToUi,
  warehouseUpdateSchema,
  type WarehouseCreateInput,
  type WarehouseUpdateInput,
} from "@/lib/warehouse-helpers";
import { prisma } from "@/lib/prisma";

export class WarehouseDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WarehouseDbError";
  }
}

export function serializeWarehouse(row: Warehouse) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    kindLabel: warehouseKindToUi(row.kind),
    address: row.address,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    totalCapacity: row.totalCapacity,
    capacityUnit: row.capacityUnit,
    managerName: row.managerName,
    managerPhone: row.managerPhone,
    managerEmail: row.managerEmail,
    accessHours: row.accessHours,
    specialConditions: row.specialConditions,
    notes: row.notes,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listWarehouses(organizationId: string) {
  const rows = await prisma.warehouse.findMany({
    where: { organizationId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { storageZones: true } } },
  });
  return rows.map((row) => ({
    ...serializeWarehouse(row),
    zoneCount: row._count.storageZones,
  }));
}

export async function getWarehouse(organizationId: string, id: string) {
  const row = await prisma.warehouse.findFirst({
    where: { id, organizationId },
  });
  if (!row) {
    throw new WarehouseDbError("Site introuvable", 404);
  }
  return serializeWarehouse(row);
}

async function assertUniqueCode(
  organizationId: string,
  code: string,
  excludeId?: string,
) {
  const existing = await prisma.warehouse.findFirst({
    where: {
      organizationId,
      code,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new WarehouseDbError(`Le code « ${code} » est déjà utilisé.`, 409);
  }
}

export async function createWarehouse(organizationId: string, raw: unknown) {
  const payload: WarehouseCreateInput = warehouseCreateSchema.parse(raw);
  const data = normalizeWarehousePayload(payload);
  if (!data.name || !data.code) {
    throw new WarehouseDbError("Nom et code requis", 400);
  }
  await assertUniqueCode(organizationId, data.code);

  const row = await prisma.warehouse.create({
    data: {
      ...data,
      organizationId,
    },
  });
  return serializeWarehouse(row);
}

export async function updateWarehouse(organizationId: string, id: string, raw: unknown) {
  const payload: WarehouseUpdateInput = warehouseUpdateSchema.parse(raw);
  const nextLat = payload.latitude !== undefined ? payload.latitude : undefined;
  const nextLng = payload.longitude !== undefined ? payload.longitude : undefined;
  if (nextLat !== undefined || nextLng !== undefined) {
    const existingGps = await prisma.warehouse.findFirst({
      where: { id, organizationId },
      select: { latitude: true, longitude: true },
    });
    if (!existingGps) {
      throw new WarehouseDbError("Site introuvable", 404);
    }
    const lat = nextLat !== undefined ? nextLat : existingGps.latitude;
    const lng = nextLng !== undefined ? nextLng : existingGps.longitude;
    if ((lat != null) !== (lng != null)) {
      throw new WarehouseDbError("Renseignez la latitude et la longitude ensemble.", 400);
    }
  }
  const existing = await prisma.warehouse.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw new WarehouseDbError("Site introuvable", 404);
  }

  const merged = normalizeWarehousePayload({
    name: payload.name ?? existing.name,
    code: payload.code ?? existing.code,
    kind: payload.kind ?? existing.kind,
    address: payload.address !== undefined ? payload.address : existing.address,
    city: payload.city !== undefined ? payload.city : existing.city,
    latitude: payload.latitude !== undefined ? payload.latitude : existing.latitude,
    longitude: payload.longitude !== undefined ? payload.longitude : existing.longitude,
    totalCapacity:
      payload.totalCapacity !== undefined ? payload.totalCapacity : existing.totalCapacity,
    capacityUnit:
      payload.capacityUnit !== undefined ? payload.capacityUnit : existing.capacityUnit,
    managerName:
      payload.managerName !== undefined ? payload.managerName : existing.managerName,
    managerPhone:
      payload.managerPhone !== undefined ? payload.managerPhone : existing.managerPhone,
    managerEmail:
      payload.managerEmail !== undefined ? payload.managerEmail : existing.managerEmail,
    accessHours:
      payload.accessHours !== undefined ? payload.accessHours : existing.accessHours,
    specialConditions:
      payload.specialConditions !== undefined
        ? payload.specialConditions
        : existing.specialConditions,
    notes: payload.notes !== undefined ? payload.notes : existing.notes,
    active: payload.active !== undefined ? payload.active : existing.active,
  });

  if (merged.code !== existing.code) {
    await assertUniqueCode(organizationId, merged.code, id);
  }

  const row = await prisma.warehouse.update({
    where: { id },
    data: merged,
  });
  return serializeWarehouse(row);
}

export async function deleteWarehouse(organizationId: string, id: string) {
  const existing = await prisma.warehouse.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw new WarehouseDbError("Site introuvable", 404);
  }
  await prisma.warehouse.delete({ where: { id } });
}
