import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const categories = await prisma.category.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createCategorySchema.parse(body);
    const { organizationId } = await getRequestContext();

    const category = await prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug.toLowerCase(),
        organizationId,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Impossible de créer la catégorie" },
      { status: 500 }
    );
  }
}
