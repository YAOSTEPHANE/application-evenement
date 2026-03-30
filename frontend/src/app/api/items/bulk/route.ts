import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const bulkRowSchema = z.object({
  name: z.string().min(2),
  reference: z.string().min(2),
  categoryId: objectId,
  unitValue: z.number().nonnegative(),
  totalQuantity: z.number().int().positive(),
  minThreshold: z.number().int().nonnegative().optional(),
  photoUrl: z.string().url().optional(),
});

const bulkBodySchema = z.object({
  items: z.array(bulkRowSchema).min(1).max(150),
});

/**
 * Crée plusieurs articles en une requête (ex. import CSV).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = bulkBodySchema.parse(body);
    const { organizationId } = await getRequestContext();

    const categoryIds = [...new Set(payload.items.map((row) => row.categoryId))];
    const categories = await prisma.category.findMany({
      where: { organizationId, id: { in: categoryIds } },
      select: { id: true },
    });
    const validCategoryIds = new Set(categories.map((c) => c.id));
    const invalidCat = categoryIds.filter((id) => !validCategoryIds.has(id));
    if (invalidCat.length > 0) {
      return NextResponse.json(
        { message: "Une ou plusieurs catégories sont introuvables pour cette organisation.", invalidCategoryIds: invalidCat },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(
      payload.items.map((row) =>
        prisma.item.create({
          data: {
            name: row.name,
            reference: row.reference,
            categoryId: row.categoryId,
            photoUrl: row.photoUrl,
            unitValue: row.unitValue,
            totalQuantity: row.totalQuantity,
            availableQty: row.totalQuantity,
            allocatedQty: 0,
            repairQty: 0,
            minThreshold: row.minThreshold ?? 0,
            organizationId,
          },
        })
      )
    );

    return NextResponse.json(
      {
        count: created.length,
        items: created.map((item) => ({
          ...item,
          isCritical: item.availableQty <= item.minThreshold,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 }
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Référence en double : un article avec la même référence existe déjà." },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "Impossible de créer les articles en masse" }, { status: 500 });
  }
}
