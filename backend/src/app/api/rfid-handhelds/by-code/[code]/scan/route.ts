import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHandheldCode } from "@/lib/rfid-handheld-helpers";
import {
  resolveActiveHandheld,
  touchHandheldLastScan,
  RfidHandheldDbError,
} from "@/lib/rfid-handheld-db";
import { handheldScanBodySchema } from "@/lib/rfid-handheld-scan";
import { getRequestContext } from "@/lib/request-context";
import { StockDocumentDbError, recordDocumentScan } from "@/lib/stock-document-db";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { organizationId } = await getRequestContext();
    const { code } = await params;
    const body = handheldScanBodySchema.parse(await request.json());
    const handheld = await resolveActiveHandheld(organizationId, {
      handheldCode: normalizeHandheldCode(code),
    });
    if (!handheld) {
      return NextResponse.json({ message: "Douchette introuvable" }, { status: 404 });
    }
    const doc = await recordDocumentScan(organizationId, body.documentId, {
      tagCodes: body.tagCodes,
      source: "HANDHELD",
      rfidHandheldId: handheld.id,
    });
    await touchHandheldLastScan(handheld.id);
    return NextResponse.json({
      ok: true,
      allowed: doc.status !== "DISPUTED",
      handheld: { id: handheld.id, code: handheld.code, label: handheld.label },
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      status: doc.status,
      message:
        doc.status === "DISPUTED"
          ? "Écart RFID — vérifiez les quantités"
          : "Scan douchette enregistré",
    });
  } catch (error) {
    if (error instanceof StockDocumentDbError || error instanceof RfidHandheldDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Payload invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Scan douchette impossible" }, { status: 500 });
  }
}
