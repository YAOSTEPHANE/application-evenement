import { StockDocumentKind, StockDocumentStatus } from "@prisma/client";

import { archiveRetentionUntil } from "@/lib/totp-auth";

export const CDC_STOCK_RULES_SECTION = "7.5";

export const CDC_STOCK_RULES_TITLE = "Règles transverses aux bons";

export const STOCK_DOCUMENT_RETENTION_YEARS = 10;

export type StockDocumentTransverseRule = {
  id: string;
  label: string;
  description: string;
};

export const CDC_STOCK_DOCUMENT_RULES: readonly StockDocumentTransverseRule[] = [
  {
    id: "sequential-number",
    label: "Numéro unique séquentiel",
    description:
      "Tous les bons (BE, BS, BT) reçoivent un numéro infalsifiable alloué par le serveur (séquence annuelle BE-AAAA-NNNN, BS-AAAA-NNNN, BT-AAAA-NNNN).",
  },
  {
    id: "no-delete",
    label: "Aucune suppression",
    description:
      "Suppression interdite. Annulation d'un bon non signé ; pour un bon signé, contre-passation (bon contraire) ou rectificatif.",
  },
  {
    id: "archive-10y",
    label: "Archivage 10 ans",
    description:
      "À la signature, archivage numérique avec empreinte SHA-256 et conservation réglementaire d'au moins 10 ans.",
  },
  {
    id: "pdf-export",
    label: "Export PDF signé",
    description:
      "Chaque bon est exportable en HTML/PDF avec signatures électroniques horodatées et empreintes de contrôle.",
  },
  {
    id: "immutable-signed",
    label: "Immuabilité après signature",
    description:
      "Un bon signé n'est plus modifiable ; toute correction passe par un bon rectificatif (nouveau document lié).",
  },
] as const;

export function formatStockDocumentNumber(kind: StockDocumentKind, year: number, seq: number): string {
  return `${kind}-${year}-${String(seq).padStart(4, "0")}`;
}

export function isStockDocumentImmutable(status: StockDocumentStatus): boolean {
  return status === StockDocumentStatus.SIGNED || status === StockDocumentStatus.CANCELLED;
}

export type MutableCheck = { ok: true } | { ok: false; message: string };

export function assertStockDocumentMutable(status: StockDocumentStatus): MutableCheck {
  if (status === StockDocumentStatus.SIGNED) {
    return {
      ok: false,
      message:
        "Bon signé — modification interdite (§7.5). Émettez un bon rectificatif ou une contre-passation.",
    };
  }
  if (status === StockDocumentStatus.CANCELLED) {
    return { ok: false, message: "Bon annulé — lecture seule." };
  }
  return { ok: true };
}

export function archiveRetentionLabel(signedAt: Date | string | null | undefined): string {
  const until = archiveRetentionUntil(signedAt ? new Date(signedAt) : new Date());
  return until.toLocaleDateString("fr-FR");
}

export function getStockDocumentRulesPublicSpec() {
  return {
    section: CDC_STOCK_RULES_SECTION,
    title: CDC_STOCK_RULES_TITLE,
    retentionYears: STOCK_DOCUMENT_RETENTION_YEARS,
    rules: CDC_STOCK_DOCUMENT_RULES,
    numberFormats: {
      BE: "BE-AAAA-NNNN",
      BS: "BS-AAAA-NNNN",
      BT: "BT-AAAA-NNNN",
    },
  };
}
