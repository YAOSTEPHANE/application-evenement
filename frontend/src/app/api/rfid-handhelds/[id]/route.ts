import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteRfidHandheld,
  getRfidHandheld,
  RfidHandheldDbError,
  updateRfidHandheld,
} from "@/lib/rfid-handheld-db";
import { getRequestContext } from "@/lib/request-context";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    return NextResponse.json(await getRfidHandheld(organizationId, id));
  } catch (error) {
    if (error instanceof RfidHandheldDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Douchette introuvable" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await updateRfidHandheld(organizationId, id, body));
  } catch (error) {
    if (error instanceof RfidHandheldDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Mise à jour impossible" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    return NextResponse.json(await deleteRfidHandheld(organizationId, id));
  } catch (error) {
    if (error instanceof RfidHandheldDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Suppression impossible" }, { status: 500 });
  }
}
