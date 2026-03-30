import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const createItemSchema = z.object({
  name: z.string().min(2),
  reference: z.string().min(2),
  categoryId: z.string().min(10),
  unitValue: z.number().nonnegative(),
  totalQuantity: z.number().int().positive(),
  minThreshold: z.number().int().nonnegative().default(0),
  photoUrl: z.string().url().optional(),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const items = await prisma.item.findMany({
    where: { organizationId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    items.map((item) => ({
      ...item,
      isCritical: item.availableQty <= item.minThreshold,
    }))
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createItemSchema.parse(body);
    const { organizationId } = await getRequestContext();

    const item = await prisma.item.create({
      data: {
        name: payload.name,
        reference: payload.reference,
        categoryId: payload.categoryId,
        photoUrl: payload.photoUrl,
        unitValue: payload.unitValue,
        totalQuantity: payload.totalQuantity,
        availableQty: payload.totalQuantity,
        allocatedQty: 0,
        repairQty: 0,
        minThreshold: payload.minThreshold,
        organizationId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Impossible de créer l'article" },
      { status: 500 }
    );
  }
}
