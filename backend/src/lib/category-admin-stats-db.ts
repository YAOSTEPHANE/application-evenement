import { prisma } from "@/lib/prisma";

export type CategoryAdminStats = {
  total: number;
  active: number;
  inactive: number;
  level0: number;
  level1: number;
  level2: number;
  itemsLinked: number;
  emptyCategories: number;
  withChildren: number;
};

export async function getCategoryAdminStats(organizationId: string): Promise<CategoryAdminStats> {
  const rows = await prisma.category.findMany({
    where: { organizationId },
    select: {
      active: true,
      level: true,
      _count: { select: { items: true, children: true } },
    },
  });

  const itemsLinked = await prisma.item.count({ where: { organizationId } });

  let active = 0;
  let level0 = 0;
  let level1 = 0;
  let level2 = 0;
  let emptyCategories = 0;
  let withChildren = 0;

  for (const row of rows) {
    if (row.active) active += 1;
    if (row.level === 0) level0 += 1;
    else if (row.level === 1) level1 += 1;
    else if (row.level === 2) level2 += 1;
    if (row._count.items === 0 && row._count.children === 0) emptyCategories += 1;
    if (row._count.children > 0) withChildren += 1;
  }

  const total = rows.length;
  return {
    total,
    active,
    inactive: total - active,
    level0,
    level1,
    level2,
    itemsLinked,
    emptyCategories,
    withChildren,
  };
}
