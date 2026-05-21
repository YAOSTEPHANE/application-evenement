
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { TrackedAssetStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();

    const [totalUnits, quarantine, onSite, inTransit, catalogAgg, itemsCount] = await Promise.all([
      prisma.trackedAsset.count({ where: { organizationId } }),
      prisma.trackedAsset.count({
        where: { organizationId, status: TrackedAssetStatus.QUARANTINE },
      }),
      prisma.trackedAsset.count({
        where: { organizationId, status: TrackedAssetStatus.ON_SITE },
      }),
      prisma.trackedAsset.count({
        where: { organizationId, status: TrackedAssetStatus.IN_TRANSIT },
      }),
      prisma.item.aggregate({
        where: { organizationId },
        _sum: { totalQuantity: true },
        _count: { id: true },
      }),
      prisma.item.count({ where: { organizationId } }),
    ]);

    const taggedSum = await prisma.trackedAsset.groupBy({
      by: ["itemId"],
      where: { organizationId },
      _count: { id: true },
    });

    const totalQty = catalogAgg._sum.totalQuantity ?? 0;
    const taggedUnits = totalUnits;
    const coveragePct = totalQty > 0 ? Math.min(100, Math.round((taggedUnits / totalQty) * 100)) : 0;

    return NextResponse.json({
      totalUnits,
      catalogItems: itemsCount,
      quarantine,
      onSite,
      inTransit,
      totalQuantity: totalQty,
      taggedUnits,
      distinctItemsTagged: taggedSum.length,
      coveragePct,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Statistiques RFID indisponibles" }, { status: 500 });
  }
}
