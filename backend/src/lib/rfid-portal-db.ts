import type { Prisma } from "@prisma/client";

import {
  normalizePortalCode,
  portalCreateSchema,
  portalUpdateSchema,
  type PortalCreateInput,
  type PortalUpdateInput,
} from "@/lib/rfid-portal-helpers";
import { prisma } from "@/lib/prisma";

const portalInclude = {
  warehouse: { select: { id: true, name: true, code: true, city: true } },
  _count: { select: { scanBatches: true } },
} satisfies Prisma.RfidPortalInclude;

export type RfidPortalRecord = Prisma.RfidPortalGetPayload<{ include: typeof portalInclude }>;

export class RfidPortalDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RfidPortalDbError";
  }
}

export function serializeRfidPortal(row: RfidPortalRecord) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    locationHint: row.locationHint,
    installationSite: row.installationSite,
    passageDirection: row.passageDirection,
    active: row.active,
    lastScanAt: row.lastScanAt?.toISOString() ?? null,
    warehouseId: row.warehouseId,
    warehouse: row.warehouse,
    scanBatchCount: row._count.scanBatches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type RfidPortalStats = {
  total: number;
  active: number;
  exitPortals: number;
  entryPortals: number;
  scannedLast24h: number;
};

export async function getRfidPortalStats(organizationId: string): Promise<RfidPortalStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, scannedLast24h] = await Promise.all([
    prisma.rfidPortal.findMany({
      where: { organizationId },
      select: { active: true, passageDirection: true },
    }),
    prisma.rfidPortal.count({
      where: { organizationId, lastScanAt: { gte: since } },
    }),
  ]);
  let active = 0;
  let exitPortals = 0;
  let entryPortals = 0;
  for (const row of rows) {
    if (row.active) active += 1;
    if (row.passageDirection === "EXIT" || row.passageDirection === "BOTH") exitPortals += 1;
    if (row.passageDirection === "ENTRY" || row.passageDirection === "BOTH") entryPortals += 1;
  }
  return {
    total: rows.length,
    active,
    exitPortals,
    entryPortals,
    scannedLast24h,
  };
}

export async function listRfidPortals(organizationId: string, activeOnly?: boolean) {
  const rows = await prisma.rfidPortal.findMany({
    where: {
      organizationId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: portalInclude,
  });
  return rows.map(serializeRfidPortal);
}

export async function getRfidPortalByCode(organizationId: string, code: string) {
  const row = await prisma.rfidPortal.findFirst({
    where: { organizationId, code: normalizePortalCode(code) },
    include: portalInclude,
  });
  if (!row) {
    throw new RfidPortalDbError("Portique introuvable", 404);
  }
  return serializeRfidPortal(row);
}

export async function getRfidPortal(organizationId: string, id: string) {
  const row = await prisma.rfidPortal.findFirst({
    where: { id, organizationId },
    include: portalInclude,
  });
  if (!row) {
    throw new RfidPortalDbError("Portique introuvable", 404);
  }
  return serializeRfidPortal(row);
}

export async function createRfidPortal(organizationId: string, raw: PortalCreateInput) {
  const data = portalCreateSchema.parse(raw);
  const code = normalizePortalCode(data.code);
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, organizationId, active: true },
  });
  if (!warehouse) {
    throw new RfidPortalDbError("Entrepôt introuvable ou inactif", 404);
  }
  const existing = await prisma.rfidPortal.findFirst({
    where: { organizationId, code },
  });
  if (existing) {
    throw new RfidPortalDbError("Ce code portique existe déjà", 409);
  }
  const row = await prisma.rfidPortal.create({
    data: {
      organizationId,
      code,
      label: data.label.trim(),
      locationHint: data.locationHint?.trim() || null,
      installationSite: data.installationSite,
      passageDirection: data.passageDirection,
      warehouseId: data.warehouseId,
      active: data.active ?? true,
    },
    include: portalInclude,
  });
  return serializeRfidPortal(row);
}

export async function updateRfidPortal(
  organizationId: string,
  id: string,
  raw: PortalUpdateInput,
) {
  const data = portalUpdateSchema.parse(raw);
  const current = await prisma.rfidPortal.findFirst({ where: { id, organizationId } });
  if (!current) {
    throw new RfidPortalDbError("Portique introuvable", 404);
  }
  if (data.warehouseId) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new RfidPortalDbError("Entrepôt introuvable", 404);
    }
  }
  if (data.code) {
    const code = normalizePortalCode(data.code);
    const clash = await prisma.rfidPortal.findFirst({
      where: { organizationId, code, id: { not: id } },
    });
    if (clash) {
      throw new RfidPortalDbError("Ce code portique existe déjà", 409);
    }
  }
  const row = await prisma.rfidPortal.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: normalizePortalCode(data.code) } : {}),
      ...(data.label !== undefined ? { label: data.label.trim() } : {}),
      ...(data.locationHint !== undefined
        ? { locationHint: data.locationHint?.trim() || null }
        : {}),
      ...(data.installationSite !== undefined ? { installationSite: data.installationSite } : {}),
      ...(data.passageDirection !== undefined ? { passageDirection: data.passageDirection } : {}),
      ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    include: portalInclude,
  });
  return serializeRfidPortal(row);
}

export async function deleteRfidPortal(organizationId: string, id: string) {
  const row = await prisma.rfidPortal.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { scanBatches: true } } },
  });
  if (!row) {
    throw new RfidPortalDbError("Portique introuvable", 404);
  }
  if (row._count.scanBatches > 0) {
    await prisma.rfidPortal.update({
      where: { id },
      data: { active: false },
    });
    return { deactivated: true as const };
  }
  await prisma.rfidPortal.delete({ where: { id } });
  return { deactivated: false as const };
}

export async function touchPortalLastScan(portalId: string) {
  await prisma.rfidPortal.update({
    where: { id: portalId },
    data: { lastScanAt: new Date() },
  });
}
