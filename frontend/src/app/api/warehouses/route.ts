
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";


import {
  createWarehouse,
  listWarehouses,
  WarehouseDbError,
} from "@/lib/warehouse-db";

export async function GET() {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const warehouses = await listWarehouses(organizationId);
    return NextResponse.json(warehouses);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Impossible de charger les entrepôts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthenticatedContext();
    const body = await request.json();
    const warehouse = await createWarehouse(organizationId, body);
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    if (error instanceof WarehouseDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload invalide", errors: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Impossible de créer le site" }, { status: 500 });
  }
}
