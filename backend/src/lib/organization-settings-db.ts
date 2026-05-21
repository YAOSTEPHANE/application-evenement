import { Prisma, Role } from "@prisma/client";

import {
  DEFAULT_ORGANIZATION_SETTINGS,
  mergeOrganizationSettings,
  organizationSettingsSchema,
  parseOrganizationSettings,
  type OrganizationSettings,
} from "@/lib/organization-settings";
import { prisma } from "@/lib/prisma";

export class OrganizationSettingsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function assertOrgSettingsAdmin(role: Role | null | undefined): void {
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    throw new OrganizationSettingsError("Droits insuffisants pour modifier les paramètres organisation.", 403);
  }
}

export async function getOrganizationSettingsBundle(organizationId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true, name: true, settings: true, updatedAt: true },
  });
  if (!org) {
    throw new OrganizationSettingsError("Organisation introuvable", 404);
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId, active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const settings = parseOrganizationSettings(org.settings);

  return {
    organization: {
      id: org.id,
      name: org.name,
      settings,
      updatedAt: org.updatedAt.toISOString(),
    },
    warehouses,
  };
}

export async function updateOrganizationSettings(
  organizationId: string,
  payload: { name?: string; settings?: Partial<OrganizationSettings> },
) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true, name: true, settings: true },
  });
  if (!org) {
    throw new OrganizationSettingsError("Organisation introuvable", 404);
  }

  let nextSettings = parseOrganizationSettings(org.settings);
  if (payload.settings) {
    const patch = organizationSettingsSchema.partial().parse(payload.settings);
    if (patch.defaultWarehouseId) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: patch.defaultWarehouseId, organizationId },
      });
      if (!wh) {
        throw new OrganizationSettingsError("Entrepôt par défaut introuvable", 404);
      }
    }
    nextSettings = mergeOrganizationSettings(nextSettings, patch);
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: payload.name?.trim() || org.name,
      settings: nextSettings as Prisma.InputJsonValue,
    },
    select: { id: true, name: true, settings: true, updatedAt: true },
  });

  return {
    id: updated.id,
    name: updated.name,
    settings: parseOrganizationSettings(updated.settings),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export { DEFAULT_ORGANIZATION_SETTINGS };
