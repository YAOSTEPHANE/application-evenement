import type { Prisma } from "@prisma/client";

import {
  handheldCreateSchema,
  handheldUpdateSchema,
  normalizeHandheldCode,
  type HandheldCreateInput,
  type HandheldUpdateInput,
} from "@/lib/rfid-handheld-helpers";
import { prisma } from "@/lib/prisma";

const handheldInclude = {
  warehouse: { select: { id: true, name: true, code: true, city: true } },
  assignedUser: { select: { id: true, fullName: true, email: true, role: true } },
  _count: { select: { scanBatches: true } },
} satisfies Prisma.RfidHandheldInclude;

export type RfidHandheldRecord = Prisma.RfidHandheldGetPayload<{ include: typeof handheldInclude }>;

export class RfidHandheldDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RfidHandheldDbError";
  }
}

export function serializeRfidHandheld(row: RfidHandheldRecord) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    serialNumber: row.serialNumber,
    batteryAutonomyHours: row.batteryAutonomyHours,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    active: row.active,
    lastScanAt: row.lastScanAt?.toISOString() ?? null,
    warehouseId: row.warehouseId,
    warehouse: row.warehouse,
    assignedUserId: row.assignedUserId,
    assignedUser: row.assignedUser,
    scanBatchCount: row._count.scanBatches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type RfidHandheldStats = {
  total: number;
  active: number;
  assigned: number;
  scannedLast24h: number;
};

export async function getRfidHandheldStats(organizationId: string): Promise<RfidHandheldStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, scannedLast24h] = await Promise.all([
    prisma.rfidHandheld.findMany({
      where: { organizationId },
      select: { active: true, assignedUserId: true },
    }),
    prisma.rfidHandheld.count({
      where: { organizationId, lastScanAt: { gte: since } },
    }),
  ]);
  let active = 0;
  let assigned = 0;
  for (const row of rows) {
    if (row.active) active += 1;
    if (row.assignedUserId) assigned += 1;
  }
  return { total: rows.length, active, assigned, scannedLast24h };
}

export async function listRfidHandhelds(organizationId: string, activeOnly?: boolean) {
  const rows = await prisma.rfidHandheld.findMany({
    where: {
      organizationId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: handheldInclude,
  });
  return rows.map(serializeRfidHandheld);
}

export async function getRfidHandheldByCode(organizationId: string, code: string) {
  const row = await prisma.rfidHandheld.findFirst({
    where: { organizationId, code: normalizeHandheldCode(code) },
    include: handheldInclude,
  });
  if (!row) {
    throw new RfidHandheldDbError("Douchette introuvable", 404);
  }
  return serializeRfidHandheld(row);
}

export async function getRfidHandheld(organizationId: string, id: string) {
  const row = await prisma.rfidHandheld.findFirst({
    where: { id, organizationId },
    include: handheldInclude,
  });
  if (!row) {
    throw new RfidHandheldDbError("Douchette introuvable", 404);
  }
  return serializeRfidHandheld(row);
}

export async function resolveActiveHandheld(
  organizationId: string,
  options: { handheldId?: string; handheldCode?: string },
) {
  if (!options.handheldId && !options.handheldCode) {
    return null;
  }
  const row = await prisma.rfidHandheld.findFirst({
    where: {
      organizationId,
      active: true,
      ...(options.handheldId
        ? { id: options.handheldId }
        : { code: normalizeHandheldCode(options.handheldCode!) }),
    },
    select: { id: true, code: true, label: true },
  });
  if (!row) {
    throw new RfidHandheldDbError("Douchette introuvable ou inactive", 404);
  }
  return row;
}

export async function createRfidHandheld(organizationId: string, raw: HandheldCreateInput) {
  const data = handheldCreateSchema.parse(raw);
  const code = normalizeHandheldCode(data.code);
  if (data.warehouseId) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId },
    });
    if (!wh) throw new RfidHandheldDbError("Entrepôt introuvable", 404);
  }
  if (data.assignedUserId) {
    const user = await prisma.user.findFirst({
      where: { id: data.assignedUserId, organizationId, active: true },
    });
    if (!user) throw new RfidHandheldDbError("Utilisateur introuvable", 404);
  }
  const existing = await prisma.rfidHandheld.findFirst({ where: { organizationId, code } });
  if (existing) throw new RfidHandheldDbError("Ce code douchette existe déjà", 409);

  const row = await prisma.rfidHandheld.create({
    data: {
      organizationId,
      code,
      label: data.label.trim(),
      serialNumber: data.serialNumber?.trim() || null,
      batteryAutonomyHours: data.batteryAutonomyHours ?? 24,
      warehouseId: data.warehouseId ?? null,
      assignedUserId: data.assignedUserId ?? null,
      active: data.active ?? true,
    },
    include: handheldInclude,
  });
  return serializeRfidHandheld(row);
}

export async function updateRfidHandheld(
  organizationId: string,
  id: string,
  raw: HandheldUpdateInput,
) {
  const data = handheldUpdateSchema.parse(raw);
  const current = await prisma.rfidHandheld.findFirst({ where: { id, organizationId } });
  if (!current) throw new RfidHandheldDbError("Douchette introuvable", 404);

  if (data.code) {
    const code = normalizeHandheldCode(data.code);
    const clash = await prisma.rfidHandheld.findFirst({
      where: { organizationId, code, id: { not: id } },
    });
    if (clash) throw new RfidHandheldDbError("Ce code douchette existe déjà", 409);
  }

  const row = await prisma.rfidHandheld.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: normalizeHandheldCode(data.code) } : {}),
      ...(data.label !== undefined ? { label: data.label.trim() } : {}),
      ...(data.serialNumber !== undefined
        ? { serialNumber: data.serialNumber?.trim() || null }
        : {}),
      ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId } : {}),
      ...(data.assignedUserId !== undefined ? { assignedUserId: data.assignedUserId } : {}),
      ...(data.batteryAutonomyHours !== undefined
        ? { batteryAutonomyHours: data.batteryAutonomyHours }
        : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    include: handheldInclude,
  });
  return serializeRfidHandheld(row);
}

export async function touchHandheldSync(handheldId: string) {
  const now = new Date();
  await prisma.rfidHandheld.update({
    where: { id: handheldId },
    data: { lastSyncAt: now, lastScanAt: now },
  });
}

export async function deleteRfidHandheld(organizationId: string, id: string) {
  const row = await prisma.rfidHandheld.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { scanBatches: true } } },
  });
  if (!row) throw new RfidHandheldDbError("Douchette introuvable", 404);
  if (row._count.scanBatches > 0) {
    await prisma.rfidHandheld.update({ where: { id }, data: { active: false } });
    return { deactivated: true as const };
  }
  await prisma.rfidHandheld.delete({ where: { id } });
  return { deactivated: false as const };
}

export async function touchHandheldLastScan(handheldId: string) {
  await touchHandheldSync(handheldId);
}
