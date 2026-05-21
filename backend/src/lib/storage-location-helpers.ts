import { StorageLocationFillState } from "@prisma/client";
import { z } from "zod";

import { parseListLines } from "@/lib/item-attribute-helpers";

export const LOCATION_CODE_REGEX = /^[A-Z0-9]{2,20}(-[A-Z0-9]{1,12}){0,5}$/;

export type StorageLocationFillStateUi = "Vide" | "Partiellement plein" | "Plein";

const FILL_STATE_VALUES = [
  StorageLocationFillState.EMPTY,
  StorageLocationFillState.PARTIAL,
  StorageLocationFillState.FULL,
] as const;

export function fillStateToUi(state: StorageLocationFillState): StorageLocationFillStateUi {
  switch (state) {
    case StorageLocationFillState.PARTIAL:
      return "Partiellement plein";
    case StorageLocationFillState.FULL:
      return "Plein";
    default:
      return "Vide";
  }
}

export function fillStateFromUi(state: StorageLocationFillStateUi): StorageLocationFillState {
  switch (state) {
    case "Partiellement plein":
      return StorageLocationFillState.PARTIAL;
    case "Plein":
      return StorageLocationFillState.FULL;
    default:
      return StorageLocationFillState.EMPTY;
  }
}

export function fillStateBadgeClass(state: StorageLocationFillState): string {
  switch (state) {
    case StorageLocationFillState.PARTIAL:
      return "badge-warn";
    case StorageLocationFillState.FULL:
      return "badge-danger";
    default:
      return "badge-ok";
  }
}

export function proposeLocationCode(warehouseCode: string, hierarchyCoordinate?: string | null): string {
  const base = warehouseCode.trim().toUpperCase();
  if (hierarchyCoordinate?.trim()) {
    return `LOC-${base}-${hierarchyCoordinate.trim().toUpperCase()}`;
  }
  return `LOC-${base}-01`;
}

const locationFieldsSchema = z.object({
  code: z.string().regex(LOCATION_CODE_REGEX, "Code invalide (ex. LOC-WH-ABJ-A-1-2-3)"),
  label: z.string().max(120).optional().nullable(),
  shelvingNodeId: z.string().optional().nullable(),
  hierarchyCoordinate: z.string().max(80).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  maxWeightKg: z.number().positive().optional().nullable(),
  maxVolumeM3: z.number().positive().optional().nullable(),
  maxItemCount: z.number().int().positive().optional().nullable(),
  fillState: z.enum(FILL_STATE_VALUES).optional(),
  minTempC: z.number().optional().nullable(),
  maxTempC: z.number().optional().nullable(),
  humidityPercent: z.number().min(0).max(100).optional().nullable(),
  accessHeightCm: z.number().positive().optional().nullable(),
  accessWidthCm: z.number().positive().optional().nullable(),
  specialConditions: z.array(z.string().max(120)).max(30).optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

function refineLocation(data: z.infer<typeof locationFieldsSchema>, ctx: z.RefinementCtx) {
  const hasLat = data.latitude != null;
  const hasLng = data.longitude != null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Renseignez la latitude et la longitude ensemble.",
      path: ["latitude"],
    });
  }
  if (data.minTempC != null && data.maxTempC != null && data.minTempC > data.maxTempC) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La température min. ne peut pas dépasser la max.",
      path: ["minTempC"],
    });
  }
}

export const storageLocationCreateSchema = locationFieldsSchema.superRefine(refineLocation);
export const storageLocationUpdateSchema = locationFieldsSchema.partial();

export type StorageLocationCreateInput = z.infer<typeof storageLocationCreateSchema>;
export type StorageLocationUpdateInput = z.infer<typeof storageLocationUpdateSchema>;

export function parseSpecialConditionsText(text: string): string[] {
  return parseListLines(text);
}

export function formatSpecialConditionsLines(items: string[] | null | undefined): string {
  return (items ?? []).join("\n");
}

export function normalizeStorageLocationPayload(
  raw: StorageLocationCreateInput | StorageLocationUpdateInput,
) {
  return {
    code: raw.code?.trim().toUpperCase() ?? "",
    label: raw.label?.trim() || null,
    shelvingNodeId: raw.shelvingNodeId ?? null,
    hierarchyCoordinate: raw.hierarchyCoordinate?.trim().toUpperCase() || null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    maxWeightKg: raw.maxWeightKg ?? null,
    maxVolumeM3: raw.maxVolumeM3 ?? null,
    maxItemCount: raw.maxItemCount ?? null,
    fillState: raw.fillState ?? StorageLocationFillState.EMPTY,
    minTempC: raw.minTempC ?? null,
    maxTempC: raw.maxTempC ?? null,
    humidityPercent: raw.humidityPercent ?? null,
    accessHeightCm: raw.accessHeightCm ?? null,
    accessWidthCm: raw.accessWidthCm ?? null,
    specialConditions: raw.specialConditions ?? [],
    notes: raw.notes?.trim() || null,
    active: raw.active ?? true,
    sortOrder: raw.sortOrder ?? 0,
  };
}
