import { z } from "zod";

export type StockQtyTotals = {
  physicalQty: number;
  systemQty: number;
  availableQty: number;
  reservedQty: number;
  inTransitQty: number;
  varianceQty: number;
};

export function emptyTotals(): StockQtyTotals {
  return {
    physicalQty: 0,
    systemQty: 0,
    availableQty: 0,
    reservedQty: 0,
    inTransitQty: 0,
    varianceQty: 0,
  };
}

export function sumTotals(rows: StockQtyTotals[]): StockQtyTotals {
  const acc = emptyTotals();
  for (const row of rows) {
    acc.physicalQty += row.physicalQty;
    acc.systemQty += row.systemQty;
    acc.availableQty += row.availableQty;
    acc.reservedQty += row.reservedQty;
    acc.inTransitQty += row.inTransitQty;
    acc.varianceQty += row.varianceQty;
  }
  return acc;
}

export function totalsFromFields(row: {
  physicalQty: number;
  systemQty: number;
  availableQty: number;
  reservedQty: number;
  inTransitQty: number;
}): StockQtyTotals {
  return {
    physicalQty: row.physicalQty,
    systemQty: row.systemQty,
    availableQty: row.availableQty,
    reservedQty: row.reservedQty,
    inTransitQty: row.inTransitQty,
    varianceQty: row.physicalQty - row.systemQty,
  };
}

const qtySchema = z.number().int().nonnegative();

export const locationStockUpsertSchema = z
  .object({
    itemId: z.string().min(1),
    itemVariantId: z.string().optional().nullable(),
    warehouseId: z.string().min(1),
    storageZoneId: z.string().min(1),
    storageLocationId: z.string().min(1),
    physicalQty: qtySchema.optional(),
    systemQty: qtySchema.optional(),
    availableQty: qtySchema.optional(),
    reservedQty: qtySchema.optional(),
    inTransitQty: qtySchema.optional(),
  })
  .superRefine((data, ctx) => {
    const physical = data.physicalQty ?? 0;
    const system = data.systemQty ?? 0;
    const available = data.availableQty ?? 0;
    const reserved = data.reservedQty ?? 0;
    const transit = data.inTransitQty ?? 0;
    const sum = available + reserved + transit;
    if (sum > system && system > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Disponible + réservé + transit ne peut pas dépasser le stock système.",
        path: ["availableQty"],
      });
    }
    if (physical > 0 && system > 0 && Math.abs(physical - system) > physical * 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Écart physique / système trop important.",
        path: ["physicalQty"],
      });
    }
    void sum;
  });

export type LocationStockUpsertInput = z.infer<typeof locationStockUpsertSchema>;
