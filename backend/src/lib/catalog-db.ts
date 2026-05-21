import { prisma } from "@/lib/prisma";

export type CatalogStats = {
  articlesCount: number;
  totalUnits: number;
  allocatedUnits: number;
  availableUnits: number;
  stockValueEstimate: number;
  categoriesCount: number;
  variantProducts: number;
  itemsWithRfid: number;
};

export async function getCatalogStats(organizationId: string): Promise<CatalogStats> {
  const [agg, categoriesCount, variantProducts, taggedGroups] = await Promise.all([
    prisma.item.aggregate({
      where: { organizationId },
      _sum: {
        totalQuantity: true,
        allocatedQty: true,
        availableQty: true,
      },
      _count: true,
    }),
    prisma.category.count({ where: { organizationId, active: true } }),
    prisma.item.count({ where: { organizationId, hasVariants: true } }),
    prisma.trackedAsset.groupBy({
      by: ["itemId"],
      where: { organizationId },
    }),
  ]);

  const items = await prisma.item.findMany({
    where: { organizationId },
    select: { unitValue: true, totalQuantity: true },
  });
  const stockValueEstimate = items.reduce(
    (sum, row) => sum + row.unitValue * row.totalQuantity,
    0,
  );

  return {
    articlesCount: agg._count,
    totalUnits: agg._sum.totalQuantity ?? 0,
    allocatedUnits: agg._sum.allocatedQty ?? 0,
    availableUnits: agg._sum.availableQty ?? 0,
    stockValueEstimate,
    categoriesCount,
    variantProducts,
    itemsWithRfid: taggedGroups.length,
  };
}
