import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ITEM_PUBLIC_SELECT,
  itemUpdateSchema,
  normalizeItemPayload,
  serializeItemRow,
} from "@/lib/item-helpers";
import { isValidMongoObjectId, jsonInvalidObjectIdResponse } from "@/lib/mongo-id";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type RouteParams = { params: Promise<{ id: string }> };

const objectId = z.string().refine(isValidMongoObjectId, { message: "ObjectId invalide" });

const updateItemSchema = itemUpdateSchema.extend({
  categoryId: objectId.optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();

    const item = await prisma.item.findFirst({
      where: { id, organizationId },
      select: ITEM_PUBLIC_SELECT,
    });

    if (!item) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    return NextResponse.json(serializeItemRow(item));
  } catch {
    return NextResponse.json({ message: "Impossible de charger l'article" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const body = await request.json();
    const payload = updateItemSchema.parse(body);
    const { organizationId } = await getRequestContext();

    const existing = await prisma.item.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    if (payload.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: payload.categoryId, organizationId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ message: "Catégorie introuvable" }, { status: 400 });
      }
    }

    const nextTotal = payload.totalQuantity ?? existing.totalQuantity;
    const minRequired = (existing.allocatedQty ?? 0) + (existing.repairQty ?? 0);
    if (nextTotal < minRequired) {
      return NextResponse.json(
        {
          message:
            "La quantité totale ne peut pas être inférieure à la quantité déjà allouée/en réparation.",
        },
        { status: 409 },
      );
    }

    const computedAvailable = nextTotal - existing.allocatedQty - existing.repairQty;
    const merged = {
      name: payload.name ?? existing.name,
      reference: payload.reference ?? existing.reference,
      categoryId: payload.categoryId ?? existing.categoryId,
      description: payload.description === undefined ? existing.description : payload.description,
      photoUrl: payload.photoUrl === undefined ? existing.photoUrl : payload.photoUrl,
      galleryUrls: payload.galleryUrls ?? existing.galleryUrls,
      emoji: payload.emoji === undefined ? existing.emoji : payload.emoji,
      notes: payload.notes === undefined ? existing.notes : payload.notes,
      brand: payload.brand === undefined ? existing.brand : payload.brand,
      model: payload.model === undefined ? existing.model : payload.model,
      variant: payload.variant === undefined ? existing.variant : payload.variant,
      weightKg: payload.weightKg === undefined ? existing.weightKg : payload.weightKg,
      lengthCm: payload.lengthCm === undefined ? existing.lengthCm : payload.lengthCm,
      widthCm: payload.widthCm === undefined ? existing.widthCm : payload.widthCm,
      heightCm: payload.heightCm === undefined ? existing.heightCm : payload.heightCm,
      barcode: payload.barcode === undefined ? existing.barcode : payload.barcode,
      serialNumber: payload.serialNumber === undefined ? existing.serialNumber : payload.serialNumber,
      lotNumber: payload.lotNumber === undefined ? existing.lotNumber : payload.lotNumber,
      supplierName: payload.supplierName === undefined ? existing.supplierName : payload.supplierName,
      unitValue: payload.unitValue ?? existing.unitValue,
      rentalPrice: payload.rentalPrice === undefined ? existing.rentalPrice : payload.rentalPrice,
      salePrice: payload.salePrice === undefined ? existing.salePrice : payload.salePrice,
      usefulLifeMonths:
        payload.usefulLifeMonths === undefined ? existing.usefulLifeMonths : payload.usefulLifeMonths,
      minThreshold: payload.minThreshold ?? existing.minThreshold,
      maxStockQty: payload.maxStockQty ?? existing.maxStockQty,
      safetyStockQty: payload.safetyStockQty ?? existing.safetyStockQty,
      optimalStockQty: payload.optimalStockQty ?? existing.optimalStockQty,
      alertThresholdQty: payload.alertThresholdQty ?? existing.alertThresholdQty,
      criticalThresholdQty: payload.criticalThresholdQty ?? existing.criticalThresholdQty,
      condition: payload.condition ?? existing.condition,
      totalQuantity: nextTotal,
    };

    const normalized = normalizeItemPayload(merged);

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...normalized,
        totalQuantity: nextTotal,
        availableQty: computedAvailable,
      },
      select: ITEM_PUBLIC_SELECT,
    });

    return NextResponse.json(serializeItemRow(item));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de modifier l'article" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!isValidMongoObjectId(id)) {
      return jsonInvalidObjectIdResponse();
    }
    const { organizationId } = await getRequestContext();

    const existing = await prisma.item.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { eventItems: true, movements: true } } },
    });

    if (!existing) {
      return NextResponse.json({ message: "Article introuvable" }, { status: 404 });
    }

    if (existing._count.eventItems > 0 || existing._count.movements > 0) {
      return NextResponse.json(
        { message: "Impossible de supprimer un article qui possède déjà des mouvements ou affectations." },
        { status: 409 },
      );
    }

    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Impossible de supprimer l'article" }, { status: 500 });
  }
}
