import { NextResponse } from "next/server";

import { archiveSignedDocument } from "@/lib/document-archive";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { getStockDocument, StockDocumentDbError } from "@/lib/stock-document-db";
import { renderStockDocumentHtml } from "@/lib/stock-document-html";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await getRequestContext();
    const { id } = await params;
    const doc = await getStockDocument(organizationId, id);
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (doc.status === "SIGNED") {
      await archiveSignedDocument(organizationId, doc, org?.name ?? "Organisation");
    }
    const archived = await prisma.documentArchive.findUnique({
      where: { stockDocumentId: doc.id },
    });
    const html = archived?.htmlSnapshot ?? renderStockDocumentHtml(doc, org?.name ?? "Organisation");
    const filename = `${doc.documentNumber.replace(/[^\w-]+/g, "_")}.html`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Document-Archive-Hash": archived?.contentHash ?? "",
      },
    });
  } catch (error) {
    if (error instanceof StockDocumentDbError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "PDF indisponible" }, { status: 500 });
  }
}
