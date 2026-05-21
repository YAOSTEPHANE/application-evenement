import { WarehouseKind } from "@prisma/client";
import { z } from "zod";

import { parseListLines } from "@/lib/item-attribute-helpers";

export const WAREHOUSE_CODE_REGEX = /^[A-Z0-9]{2,16}(-[A-Z0-9]{2,12}){0,2}$/;

export type WarehouseKindUi = "Entrepôt" | "Magasin";

export function warehouseKindToUi(kind: WarehouseKind): WarehouseKindUi {
  return kind === WarehouseKind.STORE ? "Magasin" : "Entrepôt";
}

export function warehouseKindFromUi(kind: WarehouseKindUi): WarehouseKind {
  return kind === "Magasin" ? WarehouseKind.STORE : WarehouseKind.WAREHOUSE;
}

const optionalStr = z.string().max(500).optional().nullable();
const optionalEmail = z.union([z.string().email().max(200), z.literal("")]).optional().nullable();

const warehouseBaseSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().regex(WAREHOUSE_CODE_REGEX, "Code invalide (ex. WH-ABJ ou WH-ABJ-01)"),
  kind: z.nativeEnum(WarehouseKind).optional(),
  address: optionalStr,
  city: z.string().max(120).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  totalCapacity: z.number().int().nonnegative().optional().nullable(),
  capacityUnit: z.string().max(40).optional().nullable(),
  managerName: z.string().max(200).optional().nullable(),
  managerPhone: z.string().max(40).optional().nullable(),
  managerEmail: optionalEmail,
  accessHours: z.string().max(500).optional().nullable(),
  specialConditions: z.array(z.string().max(120)).max(30).optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

export const warehouseCreateSchema = warehouseBaseSchema.superRefine((data, ctx) => {
  const hasLat = data.latitude != null;
  const hasLng = data.longitude != null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Renseignez la latitude et la longitude ensemble.",
      path: ["latitude"],
    });
  }
});

export const warehouseUpdateSchema = warehouseBaseSchema.partial();

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;

export function proposeWarehouseCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  return base ? `WH-${base}` : "WH-SITE";
}

export function parseSpecialConditionsText(text: string): string[] {
  return parseListLines(text);
}

export function formatSpecialConditionsLines(items: string[] | null | undefined): string {
  return (items ?? []).join("\n");
}

export function normalizeWarehousePayload(raw: WarehouseCreateInput | WarehouseUpdateInput) {
  const kind = raw.kind ?? WarehouseKind.WAREHOUSE;
  return {
    name: raw.name?.trim() ?? "",
    code: raw.code?.trim().toUpperCase() ?? "",
    kind,
    address: raw.address?.trim() || null,
    city: raw.city?.trim() || null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    totalCapacity: raw.totalCapacity ?? null,
    capacityUnit: raw.capacityUnit?.trim() || null,
    managerName: raw.managerName?.trim() || null,
    managerPhone: raw.managerPhone?.trim() || null,
    managerEmail: raw.managerEmail?.trim() || null,
    accessHours: raw.accessHours?.trim() || null,
    specialConditions: (raw.specialConditions ?? []).map((s) => s.trim()).filter(Boolean),
    notes: raw.notes?.trim() || null,
    active: raw.active ?? true,
  };
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
