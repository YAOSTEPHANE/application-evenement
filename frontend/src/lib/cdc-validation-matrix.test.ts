import {
  BeSubtype,
  BsSubtype,
  BtSubtype,
  StockDocumentKind,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertCanSignDocument,
  canCreateStockDocument,
  canManageUsers,
  canUseFieldApp,
  documentSignPlan,
  roleMatchesSignSlot,
  totalSignaturesRequired,
} from "@/lib/cdc-validation-matrix";

describe("cdc-validation-matrix — droits", () => {
  it("seul ADMIN gère les utilisateurs", () => {
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("STOREKEEPER")).toBe(false);
  });

  it("autorise le terrain pour magasinier et technicien", () => {
    expect(canUseFieldApp("STOREKEEPER")).toBe(true);
    expect(canUseFieldApp("TECHNICIAN")).toBe(true);
    expect(canUseFieldApp("VIEWER")).toBe(false);
  });

  it("COMMERCIAL ne crée pas de BS", () => {
    expect(canCreateStockDocument("COMMERCIAL", StockDocumentKind.BS)).toBe(false);
    expect(canCreateStockDocument("STOREKEEPER", StockDocumentKind.BS)).toBe(true);
  });
});

describe("cdc-validation-matrix — signatures", () => {
  it("BS-EVT exige 3 signatures", () => {
    expect(
      totalSignaturesRequired(StockDocumentKind.BS, { bsSubtype: BsSubtype.BS_EVT }),
    ).toBe(3);
  });

  it("BE-RET exige 2 signatures", () => {
    const plan = documentSignPlan(StockDocumentKind.BE, {
      beSubtype: BeSubtype.BE_RET,
    });
    expect(plan).toHaveLength(2);
    expect(plan[0].role).toBe("STOREKEEPER");
  });

  it("BT-SE via documentSignPlan inclut 2 rôles", () => {
    const plan = documentSignPlan(StockDocumentKind.BT, {
      btSubtype: BtSubtype.BT_SE,
    });
    expect(plan.length).toBeGreaterThanOrEqual(2);
  });

  it("refuse signature hors ordre pour VIEWER sur BS-EVT", () => {
    expect(() =>
      assertCanSignDocument("VIEWER", StockDocumentKind.BS, 0, {
        bsSubtype: BsSubtype.BS_EVT,
      }),
    ).toThrow(/signature attendue/i);
  });

  it("ADMIN peut signer le premier slot BS-EVT", () => {
    expect(() =>
      assertCanSignDocument("ADMIN", StockDocumentKind.BS, 0, {
        bsSubtype: BsSubtype.BS_EVT,
      }),
    ).not.toThrow();
  });

  it("roleMatchesSignSlot : superviseur couvre tout slot", () => {
    const slot = { role: "STOREKEEPER" as const, label: "Magasinier" };
    expect(roleMatchesSignSlot("MANAGER", slot)).toBe(true);
  });
});
