import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const LIMIT = 15;

/**
 * Recherche textuelle sur articles, événements et utilisateurs (même organisation).
 * Query : ?q=texte (minimum 2 caractères)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({
        query: q,
        items: [],
        events: [],
        users: [],
      });
    }

    const { organizationId } = await getRequestContext();

    const [items, events, users] = await Promise.all([
      prisma.item.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { reference: { contains: q, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { name: "asc" },
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.event.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { clientName: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { startsAt: "desc" },
        include: { owner: { select: { id: true, fullName: true } } },
      }),
      prisma.user.findMany({
        where: {
          organizationId,
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          avatarUrl: true,
        },
      }),
    ]);

    return NextResponse.json({
      query: q,
      items: items.map((item) => ({
        ...item,
        isCritical: item.availableQty <= item.minThreshold,
      })),
      events,
      users,
    });
  } catch {
    return NextResponse.json({ message: "Recherche impossible" }, { status: 500 });
  }
}
