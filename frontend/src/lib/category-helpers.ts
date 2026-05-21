import { z } from "zod";

/** Segments de code : MOB, MOB-CHR, MOB-CHR-NAP (max 3 niveaux). */
export const CATEGORY_CODE_REGEX = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){0,2}$/;

export const categoryMetadataSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const categoryCreateSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80),
  code: z.string().regex(CATEGORY_CODE_REGEX, "Code invalide (ex. MOB ou MOB-CHR-NAP)"),
  description: z.string().max(2000).optional().nullable(),
  photoUrl: z.union([z.string().url().max(2048), z.literal("")]).optional().nullable(),
  icon: z.string().max(8).optional().nullable(),
  metadata: categoryMetadataSchema.optional().nullable(),
  active: z.boolean().optional().default(true),
  parentId: z.string().optional().nullable(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export function slugifyCategoryName(name: string): string {
  const raw = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "categorie";
}

export function codeSegmentFromSlug(slug: string): string {
  return slug
    .replace(/-/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 12) || "CAT";
}

/** Propose un code standardisé selon le parent et le slug. */
export function proposeCategoryCode(slug: string, parentCode?: string | null): string {
  const segment = codeSegmentFromSlug(slug);
  if (!parentCode) {
    return segment;
  }
  return `${parentCode}-${segment}`;
}

export function levelFromParent(parentLevel: number | undefined): number {
  if (parentLevel === undefined) {
    return 0;
  }
  return parentLevel + 1;
}

export function assertValidHierarchy(level: number, parentId: string | null | undefined): void {
  if (level < 0 || level > 2) {
    throw new Error("Profondeur maximale : 3 niveaux (parent → enfant → sous-enfant).");
  }
  if (level === 0 && parentId) {
    throw new Error("Une catégorie racine ne peut pas avoir de parent.");
  }
  if (level > 0 && !parentId) {
    throw new Error("Une sous-catégorie doit avoir un parent.");
  }
}

export function parseMetadataLines(text: string): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const sep = line.indexOf(":");
    if (sep <= 0) {
      continue;
    }
    const key = line.slice(0, sep).trim();
    const raw = line.slice(sep + 1).trim();
    if (!key) {
      continue;
    }
    if (raw === "true") {
      result[key] = true;
    } else if (raw === "false") {
      result[key] = false;
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      result[key] = Number(raw);
    } else {
      result[key] = raw;
    }
  }
  return result;
}

export function formatMetadataLines(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
}
