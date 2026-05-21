import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { renderStockDocumentHtml } from "@/lib/stock-document-html";
import type { getStockDocument } from "@/lib/stock-document-db";
import { archiveRetentionUntil, hashDocumentContent } from "@/lib/cdc-stock-document-rules";

type Doc = Awaited<ReturnType<typeof getStockDocument>>;

export async function archiveSignedDocument(
  organizationId: string,
  doc: Doc,
  organizationName: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const existing = await db.documentArchive.findUnique({
    where: { stockDocumentId: doc.id },
  });
  if (existing) {
    return existing;
  }

  const html = renderStockDocumentHtml(doc, organizationName);
  const contentHash = hashDocumentContent(html);
  const retentionUntil = archiveRetentionUntil(doc.signedAt ?? new Date());

  const archive = await db.documentArchive.create({
    data: {
      organizationId,
      stockDocumentId: doc.id,
      contentHash,
      htmlSnapshot: html,
      retentionUntil,
    },
  });

  await db.stockDocument.update({
    where: { id: doc.id },
    data: { archivedAt: new Date() },
  });

  return archive;
}

export async function exportDailyWorkersCsv(
  organizationId: string,
  from?: Date,
  to?: Date,
  markSent = false,
): Promise<{ csv: string; count: number }> {
  const rows = await prisma.dailyWorkerEntry.findMany({
    where: {
      organizationId,
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: { event: { select: { name: true } } },
    orderBy: { workDate: "asc" },
  });

  const header =
    "date;nom;evenement;heures;taux_journalier;montant;compte_comptable;notes;envoye_paie";
  const lines = rows.map((r) => {
    const amount = (r.hoursWorked ?? 8) * (r.dailyRate ?? 0);
    const date = r.workDate.toISOString().slice(0, 10);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      date,
      esc(r.fullName),
      esc(r.event?.name ?? ""),
      String(r.hoursWorked ?? 8),
      String(r.dailyRate ?? 0),
      String(amount),
      esc(r.accountCode ?? "622"),
      esc(r.notes ?? ""),
      r.sentToPayroll ? "oui" : "non",
    ].join(";");
  });

  if (markSent && rows.length > 0) {
    await prisma.dailyWorkerEntry.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { sentToPayroll: true, payrollSentAt: new Date() },
    });
  }

  return { csv: [header, ...lines].join("\n"), count: rows.length };
}
