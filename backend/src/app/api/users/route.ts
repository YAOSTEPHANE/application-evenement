import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const createUserSchema = z.object({
  email: z.email(),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createUserSchema.parse(body);
    const { organizationId } = await getRequestContext();

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        fullName: payload.fullName,
        role: payload.role,
        organizationId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "Cet email est déjà utilisé." }, { status: 409 });
    }

    return NextResponse.json({ message: "Impossible de créer l'utilisateur" }, { status: 500 });
  }
}

