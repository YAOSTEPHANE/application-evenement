import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveActiveHandheld, touchHandheldLastScan, RfidHandheldDbError } from "@/lib/rfid-handheld-db";
import { handheldScanBodySchema } from "@/lib/rfid-handheld-scan";
import { getRequestContext } from "@/lib/request-context";
import { StockDocumentDbError, recordDocumentScan } from "@/lib/stock-document-db";

/** Douchette — scan sur un bon ouvert (inventaire / contrôle terrain). */
export async function POST(request: Request) {
  try {
    const { organizationId } = await getRequestContext();
    const body = handheldScanBodySchema.parse(await request.json());
    const handheld = await resolveActiveHandheld(organizationId, {
      handheldId: body.handheldId,
      handheldCode: body.handheldCode,
    });
    const doc = await recordDocumentScan(organizationId, body.documentId, {
      tagCodes: body.tagCodes,
      source: "HANDHELD",
      rfidHandheldId: handheld?.id ?? null,
    });
    if (handheld) {
      await touchHandheldLastScan(handheld.id);
    }
    return NextResponse.json({
      ok: true,
      allowed: doc.status !== "DISPUTED",
      handheld: handheld ?? null,
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
