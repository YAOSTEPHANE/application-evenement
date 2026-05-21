import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestContext } from "@/lib/request-context";
import {
  createWarehouse,
  listWarehouses,
  WarehouseDbError,
} from "@/lib/warehouse-db";

export async function GET() {
  try {
    const { organizationId } = await getRequestContext();
    const warehouses = await listWarehouses(organizationId);
    return NextResponse.json(warehouses);
  } catch {
    return NextResponse.json({ message: "Impossible de charger les entrepôts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
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
