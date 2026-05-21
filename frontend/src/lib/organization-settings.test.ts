import { describe, expect, it } from "vitest";

import {
  DEFAULT_ORGANIZATION_SETTINGS,
  mergeOrganizationSettings,
  parseOrganizationSettings,
} from "@/lib/organization-settings";

const VALID_OID = "507f1f77bcf86cd799439011";

describe("parseOrganizationSettings", () => {
  it("retourne les défauts si raw est null", () => {
    expect(parseOrganizationSettings(null)).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
  });

  it("ignore un ObjectId invalide et garde les défauts", () => {
    expect(
      parseOrganizationSettings({ defaultWarehouseId: "not-an-object-id" }),
    ).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
  });

  it("parse un entrepôt par défaut valide", () => {
    expect(parseOrganizationSettings({ defaultWarehouseId: VALID_OID })).toEqual({
      ...DEFAULT_ORGANIZATION_SETTINGS,
      defaultWarehouseId: VALID_OID,
    });
  });
});

describe("mergeOrganizationSettings", () => {
  it("peut effacer l'entrepôt par défaut", () => {
    const merged = mergeOrganizationSettings(
      { ...DEFAULT_ORGANIZATION_SETTINGS, defaultWarehouseId: VALID_OID },
      { defaultWarehouseId: null },
    );
    expect(merged.defaultWarehouseId).toBeNull();
  });
});
