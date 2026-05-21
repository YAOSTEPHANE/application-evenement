import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { resolveActiveHandheld, touchHandheldLastScan, RfidHandheldDbError } from "@/lib/rfid-handheld-db";
import { handheldScanBodySchema } from "@/lib/rfid-handheld-scan";
import { StockDocumentDbError, recordDocumentScan } from "@/lib/stock-document-db";

/** Douchette — scan sur un bon ouvert (inventaire / contrôle terrain). */
export async function POST(request: Request) {
  try {
    const body = handheldScanBodySchema.parse(await request.json());
    const scope = `handheld:scan:${body.documentId}`;

    return await handleAuthenticatedIdempotentPost(request, scope, async (ctx) => {
      const handheld = await resolveActiveHandheld(ctx.organizationId, {
        handheldId: body.handheldId,
        handheldCode: body.handheldCode,
      });
      const doc = await recordDocumentScan(ctx.organizationId, body.documentId, {
        tagCodes: body.tagCodes,
        source: "HANDHELD",
        rfidHandheldId: handheld?.id ?? null,
      });
      if (handheld) {
        await touchHandheldLastScan(handheld.id);
      }
      return {
        status: 200,
        body: {
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
        },
      };
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
