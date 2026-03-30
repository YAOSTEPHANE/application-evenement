import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

export async function GET() {
  const { organizationId, actorId, authMethod } = await getRequestContext();

  if (!actorId || authMethod === "none") {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: actorId, organizationId },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      avatarUrl: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "Utilisateur introuvable." }, { status: 401 });
  }

  return NextResponse.json(user);
}
