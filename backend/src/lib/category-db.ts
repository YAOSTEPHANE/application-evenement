import type { Prisma } from "@prisma/client";

import {
  assertValidHierarchy,
  categoryCreateSchema,
  categoryUpdateSchema,
  levelFromParent,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from "@/lib/category-helpers";
import { prisma } from "@/lib/prisma";

const categoryInclude = {
  parent: { select: { id: true, name: true, code: true, level: true } },
  _count: { select: { items: true, children: true } },
} satisfies Prisma.CategoryInclude;

export type CategoryRecord = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

export function serializeCategory(row: CategoryRecord) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description,
    photoUrl: row.photoUrl,
    icon: row.icon,
    metadata: row.metadata,
    active: row.active,
    level: row.level,
    parentId: row.parentId,
    parent: row.parent,
    itemCount: row._count.items,
    childrenCount: row._count.children,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveParent(organizationId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return { level: 0, parent: null as null };
  }
  const parent = await prisma.category.findFirst({
    where: { id: parentId, organizationId },
    select: { id: true, level: true, code: true, name: true },
  });
  if (!parent) {
    throw new CategoryDbError("Catégorie parente introuvable", 404);
  }
  if (parent.level >= 2) {
    throw new CategoryDbError(
      "Impossible d’ajouter un niveau : la profondeur maximale est 3 (sous-enfant).",
      400,
    );
  }
  return { level: levelFromParent(parent.level), parent };
}

export class CategoryDbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CategoryDbError";
  }
}

export async function listCategories(organizationId: string) {
  const rows = await prisma.category.findMany({
    where: { organizationId },
    orderBy: [{ level: "asc" }, { code: "asc" }],
    include: categoryInclude,
  });
  return rows.map(serializeCategory);
}

export async function getCategory(organizationId: string, id: string) {
  const row = await prisma.category.findFirst({
    where: { id, organizationId },
    include: categoryInclude,
  });
  if (!row) {
    throw new CategoryDbError("Catégorie introuvable", 404);
  }
  return serializeCategory(row);
}

export async function createCategory(organizationId: string, raw: unknown) {
  const payload: CategoryCreateInput = categoryCreateSchema.parse(raw);
  const { level, parent } = await resolveParent(organizationId, payload.parentId ?? null);
  assertValidHierarchy(level, payload.parentId ?? null);

  const photoUrl = payload.photoUrl?.trim() ? payload.photoUrl.trim() : null;

  const duplicate = await prisma.category.findFirst({
    where: {
      organizationId,
      OR: [{ slug: payload.slug.toLowerCase() }, { code: payload.code.toUpperCase() }],
    },
  });
  if (duplicate) {
    throw new CategoryDbError("Slug ou code déjà utilisé dans cette organisation.", 409);
  }

  const row = await prisma.category.create({
    data: {
      name: payload.name.trim(),
      slug: payload.slug.toLowerCase(),
      code: payload.code.toUpperCase(),
      description: payload.description?.trim() || null,
      photoUrl,
      icon: payload.icon?.trim() || null,
      metadata: payload.metadata ?? undefined,
      active: payload.active ?? true,
      level,
      parentId: parent?.id ?? null,
      organizationId,
    },
    include: categoryInclude,
  });
  return serializeCategory(row);
}

export async function updateCategory(organizationId: string, id: string, raw: unknown) {
  const payload: CategoryUpdateInput = categoryUpdateSchema.parse(raw);
  const existing = await prisma.category.findFirst({
    where: { id, organizationId },
    include: categoryInclude,
  });
  if (!existing) {
    throw new CategoryDbError("Catégorie introuvable", 404);
  }

  let level = existing.level;
  let parentId = existing.parentId;

  if (payload.parentId !== undefined && payload.parentId !== existing.parentId) {
    if (existing._count.children > 0) {
      throw new CategoryDbError(
        "Impossible de changer le parent : des sous-catégories existent encore.",
        409,
      );
    }
    const resolved = await resolveParent(organizationId, payload.parentId);
    level = resolved.level;
    parentId = resolved.parent?.id ?? null;
    assertValidHierarchy(level, parentId);
  }

  const nextSlug = payload.slug?.toLowerCase() ?? existing.slug;
  const nextCode = payload.code?.toUpperCase() ?? existing.code;

  if (payload.slug || payload.code) {
    const clash = await prisma.category.findFirst({
      where: {
        organizationId,
        id: { not: id },
        OR: [{ slug: nextSlug }, { code: nextCode }],
      },
    });
    if (clash) {
      throw new CategoryDbError("Slug ou code déjà utilisé.", 409);
    }
  }

  const photoUrl =
    payload.photoUrl === undefined
      ? existing.photoUrl
      : payload.photoUrl?.trim()
        ? payload.photoUrl.trim()
        : null;

  const row = await prisma.category.update({
    where: { id },
    data: {
      name: payload.name?.trim() ?? existing.name,
      slug: nextSlug,
      code: nextCode,
      description:
        payload.description === undefined
          ? existing.description
          : payload.description?.trim() || null,
      photoUrl,
      icon: payload.icon === undefined ? existing.icon : payload.icon?.trim() || null,
      metadata: payload.metadata === undefined ? existing.metadata : payload.metadata ?? undefined,
      active: payload.active ?? existing.active,
      level,
      parentId,
    },
    include: categoryInclude,
  });
  return serializeCategory(row);
}

export async function deleteCategory(organizationId: string, id: string) {
  const existing = await prisma.category.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { items: true, children: true } } },
  });
  if (!existing) {
    throw new CategoryDbError("Catégorie introuvable", 404);
  }
  if (existing._count.items > 0) {
    throw new CategoryDbError("Impossible de supprimer une catégorie contenant des articles.", 409);
  }
  if (existing._count.children > 0) {
    throw new CategoryDbError("Supprimez d’abord les sous-catégories.", 409);
  }
  await prisma.category.delete({ where: { id } });
}
