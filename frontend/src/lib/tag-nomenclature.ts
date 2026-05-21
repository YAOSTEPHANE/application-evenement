/**
 * Nomenclature CDC — identifiant unitaire tagué : TAG-XXXX-YYYY
 * XXXX = segment catégorie (4 caractères), YYYY = séquence (4 chiffres).
 */

export const TAG_CATEGORY_SEGMENT_LEN = 4;
export const TAG_SEQUENCE_LEN = 4;

/** Format strict TAG-XXXX-YYYY */
export const TAG_CODE_REGEX = /^TAG-[A-Z0-9]{4}-\d{4}$/;

export type ParsedTagCode = {
  raw: string;
  categorySegment: string;
  sequence: number;
};

export function categoryCodeToTagSegment(categoryCode: string): string {
  const raw = categoryCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const segment = (raw || "GEN").slice(0, TAG_CATEGORY_SEGMENT_LEN);
  return segment.padEnd(TAG_CATEGORY_SEGMENT_LEN, "X");
}

export function formatTagCode(categoryCode: string, sequence: number): string {
  const segment = categoryCodeToTagSegment(categoryCode);
  const seq = Math.max(1, Math.min(9999, Math.floor(sequence)));
  return `TAG-${segment}-${String(seq).padStart(TAG_SEQUENCE_LEN, "0")}`;
}

export function normalizeTagCode(input: string): string {
  return input.trim().toUpperCase();
}

export function parseTagCode(input: string): ParsedTagCode | null {
  const raw = normalizeTagCode(input);
  const match = TAG_CODE_REGEX.exec(raw);
  if (!match) {
    return null;
  }
  const parts = raw.split("-");
  const categorySegment = parts[1] ?? "";
  const sequence = Number.parseInt(parts[2] ?? "0", 10);
  if (!Number.isFinite(sequence) || sequence < 1) {
    return null;
  }
  return { raw, categorySegment, sequence };
}

export function assertValidTagCodeFormat(input: string): string {
  const raw = normalizeTagCode(input);
  if (!TAG_CODE_REGEX.test(raw)) {
    throw new Error("Format attendu : TAG-XXXX-YYYY (ex. TAG-MOBX-0001)");
  }
  return raw;
}

/** Vérifie que le tag correspond à la catégorie de l'article. */
export function assertTagMatchesCategory(tagCode: string, categoryCode: string): void {
  const parsed = parseTagCode(tagCode);
  if (!parsed) {
    throw new Error("Identifiant tag invalide");
  }
  const expected = categoryCodeToTagSegment(categoryCode);
  if (parsed.categorySegment !== expected) {
    throw new Error(
      `Le segment catégorie doit être ${expected} (catégorie ${categoryCode}), reçu ${parsed.categorySegment}`,
    );
  }
}

export function tagCodePrefixForCategory(categoryCode: string): string {
  return `TAG-${categoryCodeToTagSegment(categoryCode)}-`;
}
