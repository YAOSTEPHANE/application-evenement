
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ITEM_PUBLIC_SELECT,
  itemWriteBaseSchema,
  normalizeItemPayload,
  refineStockLevels,
  serializeItemRow,
} from "@/lib/item-helpers";
import {
  upsertItemVariants,
  VARIANT_PUBLIC_SELECT,
  serializeVariantRow,
  variantWriteSchema,
} from "@/lib/item-variant-helpers";
import { isValidMongoObjectId } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const createItemSchema = itemWriteBaseSchema
  .extend({
    categoryId: objectId,
    totalQuantity: z.number().int().nonnegative(),
    hasVariants: z.boolean().optional(),
    variants: z.array(variantWriteSchema).max(50).optional(),
  })
  .superRefine(refineStockLevels)
  .superRefine((data, ctx) => {
    if (data.hasVariants) {
      if (!data.variants?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ajoutez au moins une variante.",
          path: ["variants"],
        });
      }
    } else {
      if (data.variants?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Les variantes ne sont autorisées que si le produit est multi-variantes.",
          path: ["variants"],
        });
      }
      if (data.totalQuantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La quantité totale doit être positive.",
          path: ["totalQuantity"],
        });
      }
    }
  });

type ItemRowInput = Parameters<typeof serializeItemRow>[0];
type RawVariantInput = Parameters<typeof serializeVariantRow>[0];

function serializeItemWithVariants(
  item: Omit<ItemRowInput, "variants"> & { variants?: RawVariantInput[] },
) {
  const { variants, ...rest } = item;
  return serializeItemRow({
    ...rest,
    variants: (variants ?? []).map(serializeVariantRow),
  });
}

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();

    const items = await prisma.item.findMany({
      where: { organizationId },
      select: {
        ...ITEM_PUBLIC_SELECT,
        variants: {
          select: VARIANT_PUBLIC_SELECT,
          orderBy: [{ sortOrder: "asc" }, { reference: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items.map(serializeItemWithVariants));
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[GET /api/items]", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les articles";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createItemSchema.parse(body);
    const { organizationId } = await requireAuthenticatedContext();

    const category = await prisma.category.findFirst({
      where: { id: payload.categoryId, organizationId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ message: "Catégorie introuvable" }, { status: 400 });
    }

    const hasVariants = Boolean(payload.hasVariants && payload.variants?.length);
    const data = normalizeItemPayload(payload);

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          ...data,
          hasVariants,
          totalQuantity: hasVariants ? 0 : payload.totalQuantity,
          availableQty: hasVariants ? 0 : payload.totalQuantity,
          allocatedQty: 0,
          repairQty: 0,
          organizationId,
        },
        select: { ...ITEM_PUBLIC_SELECT, variants: { select: VARIANT_PUBLIC_SELECT } },
      });

      if (hasVariants && payload.variants) {
        await upsertItemVariants(tx, organizationId, created.id, payload.variants);
      }

      return tx.item.findFirst({
        where: { id: created.id },
        select: {
          ...ITEM_PUBLIC_SELECT,
          variants: {
            select: VARIANT_PUBLIC_SELECT,
            orderBy: [{ sortOrder: "asc" }, { reference: "asc" }],
          },
        },
      });
    });

    if (!item) {
      return NextResponse.json({ message: "Impossible de créer l'article" }, { status: 500 });
    }

    return NextResponse.json(serializeItemWithVariants(item), { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("variante")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json({ message: "Impossible de créer l'article" }, { status: 500 });
  }
}
