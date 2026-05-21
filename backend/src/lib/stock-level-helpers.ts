import { z } from "zod";

/** Niveaux de stock (quantités entières ; 0 = non configuré). */
export type StockLevels = {
  min: number;
  max: number;
  safety: number;
  optimal: number;
  alert: number;
  critical: number;
};

export const EMPTY_STOCK_LEVELS: StockLevels = {
  min: 0,
  max: 0,
  safety: 0,
  optimal: 0,
  alert: 0,
  critical: 0,
};

export type StockLevelStatus =
  | "rupture"
  | "critical"
  | "alert"
  | "reorder"
  | "below_safety"
  | "overstock"
  | "ok";

const levelInt = z.number().int().nonnegative();

export const stockLevelsSchema = z
  .object({
    min: levelInt.default(0),
    max: levelInt.default(0),
    safety: levelInt.default(0),
    optimal: levelInt.default(0),
    alert: levelInt.default(0),
    critical: levelInt.default(0),
  })
  .superRefine((data, ctx) => {
    const chain = [
      { key: "critical" as const, label: "Seuil critique" },
      { key: "alert" as const, label: "Seuil d'alerte" },
      { key: "min" as const, label: "Stock minimum" },
      { key: "safety" as const, label: "Stock de sécurité" },
      { key: "optimal" as const, label: "Stock optimal" },
      { key: "max" as const, label: "Stock maximum" },
    ];
    let prev = 0;
    let prevKey: keyof StockLevels | null = null;
    for (const { key, label } of chain) {
      const v = data[key];
      if (v <= 0) {
        continue;
      }
      if (prevKey && v < prev) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} doit être ≥ ${chain.find((c) => c.key === prevKey)?.label ?? "niveau précédent"} (${prev}).`,
          path: [key],
        });
      }
      prev = v;
      prevKey = key;
    }
    if (data.max > 0 && data.optimal > 0 && data.max < data.optimal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le stock maximum doit être ≥ le stock optimal.",
        path: ["max"],
      });
    }
  });

export function stockLevelsFromDb(row: {
  minThreshold: number;
  maxStockQty?: number;
  safetyStockQty?: number;
  optimalStockQty?: number;
  alertThresholdQty?: number;
  criticalThresholdQty?: number;
}): StockLevels {
  return {
    min: row.minThreshold ?? 0,
    max: row.maxStockQty ?? 0,
    safety: row.safetyStockQty ?? 0,
    optimal: row.optimalStockQty ?? 0,
    alert: row.alertThresholdQty ?? 0,
    critical: row.criticalThresholdQty ?? 0,
  };
}

export function stockLevelsToDb(levels: StockLevels) {
  return {
    minThreshold: levels.min,
    maxStockQty: levels.max,
    safetyStockQty: levels.safety,
    optimalStockQty: levels.optimal,
    alertThresholdQty: levels.alert,
    criticalThresholdQty: levels.critical,
  };
}

export function normalizeStockLevels(raw: Partial<StockLevels> | undefined): StockLevels {
  return stockLevelsSchema.parse({
    min: raw?.min ?? 0,
    max: raw?.max ?? 0,
    safety: raw?.safety ?? 0,
    optimal: raw?.optimal ?? 0,
    alert: raw?.alert ?? 0,
    critical: raw?.critical ?? 0,
  });
}

/** Statut dérivé du stock disponible et des seuils configurés. */
export function computeStockLevelStatus(
  availableQty: number,
  levels: Partial<StockLevels> | StockLevels | null | undefined,
): StockLevelStatus {
  const normalized = normalizeStockLevels(levels ?? undefined);
  const available = Math.max(0, availableQty);
  if (available === 0) {
    return "rupture";
  }
  if (normalized.max > 0 && available > normalized.max) {
    return "overstock";
  }
  if (normalized.critical > 0 && available <= normalized.critical) {
    return "critical";
  }
  if (normalized.alert > 0 && available <= normalized.alert) {
    return "alert";
  }
  if (normalized.min > 0 && available <= normalized.min) {
    return "reorder";
  }
  if (normalized.safety > 0 && available <= normalized.safety) {
    return "below_safety";
  }
  return "ok";
}

export function isStockAlertStatus(status: StockLevelStatus): boolean {
  return status === "rupture" || status === "critical" || status === "alert" || status === "reorder";
}

export function stockLevelStatusLabel(status: StockLevelStatus): string {
  switch (status) {
    case "rupture":
      return "Rupture";
    case "critical":
      return "Critique";
    case "alert":
      return "Alerte";
    case "reorder":
      return "Réappro.";
    case "below_safety":
      return "Sous sécurité";
    case "overstock":
      return "Surstock";
    default:
      return "OK";
  }
}

export function stockLevelBadgeClass(status: StockLevelStatus): string {
  switch (status) {
    case "rupture":
    case "critical":
      return "badge-danger";
    case "alert":
    case "reorder":
      return "badge-warn";
    case "below_safety":
      return "badge-warn";
    case "overstock":
      return "badge-outline";
    default:
      return "badge-ok";
  }
}

export const STOCK_LEVEL_FIELD_HINTS: Array<{ key: keyof StockLevels; label: string; hint: string }> = [
  { key: "critical", label: "Seuil critique", hint: "Rupture imminente" },
  { key: "alert", label: "Seuil d'alerte", hint: "Notification équipe" },
  { key: "min", label: "Stock minimum", hint: "Déclenche le réapprovisionnement" },
  { key: "safety", label: "Stock de sécurité", hint: "Tampon / buffer" },
  { key: "optimal", label: "Stock optimal", hint: "Cible de réappro" },
  { key: "max", label: "Stock maximum", hint: "Capacité / plafond" },
];
