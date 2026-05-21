import { Prisma } from "@prisma/client";
import { z } from "zod";

import { formatMetadataLines, parseMetadataLines } from "@/lib/category-helpers";

export const itemCustomFieldsSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([z.string().max(500), z.number(), z.boolean()]),
  )
  .optional()
  .nullable();

export const itemAttributesSchema = z.object({
  customFields: itemCustomFieldsSchema,
  technicalParams: z.string().max(8000).optional().nullable(),
  certifications: z.array(z.string().max(200)).max(50).optional(),
  safetyStandards: z.array(z.string().max(200)).max(50).optional(),
  specialInstructions: z.string().max(4000).optional().nullable(),
});

export type ItemAttributesInput = z.infer<typeof itemAttributesSchema>;

export function parseListLines(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of text.split("\n")) {
    const value = line.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    items.push(value);
  }
  return items;
}

export function formatListLines(items: string[] | null | undefined): string {
  return (items ?? []).join("\n");
}

export function parseCustomFieldsText(text: string): Record<string, string | number | boolean> {
  return parseMetadataLines(text);
}

export function formatCustomFieldsText(
  fields: Record<string, unknown> | null | undefined,
): string {
  return formatMetadataLines(fields);
}

export function normalizeItemAttributes(raw: ItemAttributesInput) {
  const customFields = raw.customFields ?? null;
  const hasCustom =
    customFields && typeof customFields === "object" && Object.keys(customFields).length > 0;

  return {
    customFields: hasCustom ? (customFields as Prisma.InputJsonValue) : null,
    technicalParams: raw.technicalParams?.trim() || null,
    certifications: (raw.certifications ?? []).map((s) => s.trim()).filter(Boolean),
    safetyStandards: (raw.safetyStandards ?? []).map((s) => s.trim()).filter(Boolean),
    specialInstructions: raw.specialInstructions?.trim() || null,
  };
}

export const ITEM_ATTRIBUTES_SELECT = {
  customFields: true,
  technicalParams: true,
  certifications: true,
  safetyStandards: true,
  specialInstructions: true,
} as const;
