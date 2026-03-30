import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const createItemSchema = z.object({
  name: z.string().min(2),
  reference: z.string().min(2),
  categoryId: objectId,
  unitValue: z.number().nonnegative(),
  totalQuantity: z.number().int().positive(),
  minThreshold: z.number().int().nonnegative().default(0),
  photoUrl: z.string().url().optional(),
});

export async function GET() {
  const { organizationId } = await getRequestContext();

  const items = await prisma.item.findMany({
    where: { organizationId },
    // On évite de résoudre la relation `category` car certaines données peuvent être incohérentes
    // (Prisma: "Inconsistent query result: Field category is required... got null").
    // Le frontend récupère ensuite le nom via GET /api/categories + categoryId.
    select: {
      id: true,
      name: true,
      reference: true,
      photoUrl: true,
      unitValue: true,
      totalQuantity: true,
      availableQty: true,
      allocatedQty: true,
      minThreshold: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
    },
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
