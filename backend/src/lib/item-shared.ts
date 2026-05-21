/** Helpers articles partagés client / serveur (sans @prisma/client). */

export type ArticleConditionUi = "Neuf" | "Bon" | "À réparer" | "Obsolète";

export const ITEM_CONDITION = {
  NEW: "NEW",
  GOOD: "GOOD",
  NEEDS_REPAIR: "NEEDS_REPAIR",
  OBSOLETE: "OBSOLETE",
} as const;

export type ItemConditionValue = (typeof ITEM_CONDITION)[keyof typeof ITEM_CONDITION];

export function conditionFromUi(value: ArticleConditionUi): ItemConditionValue {
  switch (value) {
    case "Neuf":
      return ITEM_CONDITION.NEW;
    case "À réparer":
      return ITEM_CONDITION.NEEDS_REPAIR;
    case "Obsolète":
      return ITEM_CONDITION.OBSOLETE;
    default:
      return ITEM_CONDITION.GOOD;
  }
}

export function parseGalleryLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);
}

export function formatGalleryLines(urls: string[] | null | undefined): string {
  if (!urls?.length) {
    return "";
  }
  return urls.join("\n");
}
