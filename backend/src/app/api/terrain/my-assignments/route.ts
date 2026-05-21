import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  try {
    const { organizationId, actorId } = await getRequestContext();
    if (!actorId) {
      return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
    }

    const [assignments, leaderEvents] = await Promise.all([
      prisma.projectAssignment.findMany({
        where: { organizationId, userId: actorId },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              location: true,
              clientName: true,
              startsAt: true,
              endsAt: true,
              orderStatus: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.event.findMany({
        where: { organizationId, teamLeaderId: actorId },
        select: {
          id: true,
          name: true,
          location: true,
          clientName: true,
          startsAt: true,
          endsAt: true,
          orderStatus: true,
        },
        orderBy: { startsAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({ assignments, leaderEvents });
  } catch {
    return NextResponse.json({ message: "Impossible de charger les affectations" }, { status: 500 });
  }
}
