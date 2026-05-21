import { describe, expect, it } from "vitest";

import { organizationSettingsSchema } from "@/lib/organization-settings";

const VALID_OID = "507f1f77bcf86cd799439011";

describe("organizationSettingsSchema", () => {
  it("accepte un patch minimal valide", () => {
    const r = organizationSettingsSchema.safeParse({
      defaultWarehouseId: VALID_OID,
      inventoryVarianceTargetPct: 2,
    });
    expect(r.success).toBe(true);
  });

  it("rejette un pourcentage hors bornes", () => {
    const r = organizationSettingsSchema.safeParse({ inventoryVarianceTargetPct: 150 });
    expect(r.success).toBe(false);
  });
});
