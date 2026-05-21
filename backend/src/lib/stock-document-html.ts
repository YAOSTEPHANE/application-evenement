import {
  BE_SUBTYPE_LABELS,
  BS_SUBTYPE_LABELS,
  BT_SUBTYPE_LABELS,
  DOC_KIND_LABELS,
  DOC_STATUS_LABELS,
} from "@/lib/cdc-labels";
import { archiveRetentionUntil, hashDocumentContent } from "@/lib/cdc-stock-document-rules";
import type { getStockDocument } from "@/lib/stock-document-db";

type Doc = Awaited<ReturnType<typeof getStockDocument>>;

function subtypeLabel(doc: Doc): string {
  if (doc.beSubtype) return BE_SUBTYPE_LABELS[doc.beSubtype];
  if (doc.bsSubtype) return BS_SUBTYPE_LABELS[doc.bsSubtype];
  if (doc.btSubtype) return BT_SUBTYPE_LABELS[doc.btSubtype];
  return "—";
}

/** Archive imprimable CDC (HTML → PDF navigateur) */
export function renderStockDocumentHtml(doc: Doc, organizationName: string): string {
  const signedAt = doc.signedAt ? new Date(doc.signedAt).toLocaleString("fr-FR") : "—";
  const retention = archiveRetentionUntil(doc.signedAt ?? new Date()).toLocaleDateString("fr-FR");
  const lines = doc.lines
    .map(
      (l) =>
        `<tr><td>${l.designation ?? l.itemId}</td><td>${l.expectedQty}</td><td>${l.scannedQty}</td><td>${l.receivedQty}</td></tr>`,
    )
    .join("");
  const signatures = doc.signatures
    .map(
      (s) =>
        `<tr><td>${s.user.fullName}</td><td>${s.roleAtSign}</td><td>${new Date(s.signedAt).toLocaleString("fr-FR")}</td><td>${s.signatureHash ?? "—"}</td></tr>`,
    )
    .join("");

  const core = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${doc.documentNumber}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 0.85rem; }
    th { background: #f4f4f5; }
    .meta { font-size: 0.9rem; color: #444; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <h1>${DOC_KIND_LABELS[doc.kind]} — ${doc.documentNumber}</h1>
  <p class="meta"><em>Export PDF signé électroniquement (§7.5) — document infalsifiable après signature.</em></p>
  <p class="meta"><strong>${organizationName}</strong> · ${subtypeLabel(doc)} · ${DOC_STATUS_LABELS[doc.status]}</p>
  <p class="meta">Événement : ${doc.event?.name ?? "—"} · Signé le : ${signedAt}</p>
  <p class="meta">De : ${doc.fromWarehouse?.name ?? "—"} → ${doc.toWarehouse?.name ?? "—"}</p>
  <h2>Lignes</h2>
  <table><thead><tr><th>Désignation</th><th>Prévu</th><th>Scanné</th><th>Reçu</th></tr></thead><tbody>${lines}</tbody></table>
  <h2>Signatures électroniques</h2>
  <table><thead><tr><th>Signataire</th><th>Rôle</th><th>Date</th><th>Empreinte</th></tr></thead><tbody>${signatures || "<tr><td colspan=\"4\">Aucune</td></tr>"}</tbody></table>`;

  const hash = hashDocumentContent(core);
  return `${core}
  <p class="meta" style="margin-top:24px">
    Document archivé EVENT//RFID — empreinte SHA-256 : <code>${hash}</code><br />
    Conservation réglementaire jusqu'au ${retention} (CDC 10 ans).
    Valeur probante : signatures horodatées, scan RFID tracé.
  </p>
</body>
</html>`;
}
