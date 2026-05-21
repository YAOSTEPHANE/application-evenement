
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CategoryDbError,
  createCategory,
  listCategories,
} from "@/lib/category-db";

export async function GET() {
  const { organizationId } = await requireAuthenticatedContext();
  const categories = await listCategories(organizationId);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const category = await createCategory(organizationId, body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof CategoryDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de créer la catégorie" }, { status: 500 });
  }
}
