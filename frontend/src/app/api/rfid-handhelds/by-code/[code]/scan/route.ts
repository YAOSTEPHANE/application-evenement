import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAuthenticatedIdempotentPost } from "@/lib/api-route-helpers";
import { normalizeHandheldCode } from "@/lib/rfid-handheld-helpers";
import {
  resolveActiveHandheld,
  touchHandheldLastScan,
  RfidHandheldDbError,
} from "@/lib/rfid-handheld-db";
import { handheldScanBodySchema } from "@/lib/rfid-handheld-scan";
import { StockDocumentDbError, recordDocumentScan } from "@/lib/stock-document-db";

type Params = { params: Promise<{ code: string }> };

/** Point d'entrée matériel : POST /api/rfid-handhelds/by-code/{code}/scan */
export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const body = handheldScanBodySchema.parse(await request.json());
    const normalized = normalizeHandheldCode(code);

    return await handleAuthenticatedIdempotentPost(
      request,
      `rfid-handheld:scan:${normalized}:${body.documentId}`,
      async (ctx) => {
        const handheld = await resolveActiveHandheld(ctx.organizationId, {
          handheldCode: normalized,
        });
        if (!handheld) {
          return { status: 404, body: { message: "Douchette introuvable" } };
        }
        const doc = await recordDocumentScan(ctx.organizationId, body.documentId, {
          tagCodes: body.tagCodes,
          source: "HANDHELD",
          rfidHandheldId: handheld.id,
        });
        await touchHandheldLastScan(handheld.id);
        return {
          status: 200,
          body: {
            ok: true,
            allowed: doc.status !== "DISPUTED",
            handheld,
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            status: doc.status,
            message:
              doc.status === "DISPUTED"
                ? "Écart RFID — vérifiez les quantités"
                : "Scan douchette enregistré",
          },
        };
      },
    );
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
