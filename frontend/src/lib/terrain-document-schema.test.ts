import { BsSubtype, BtSubtype, StockDocumentKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { terrainCreateDocumentSchema } from "@/lib/terrain-document-schema";

const VALID_OID = "507f1f77bcf86cd799439011";
const OTHER_OID = "507f191e810c19729de860ea";

describe("terrainCreateDocumentSchema", () => {
  it("valide un BS-EVT terrain", () => {
    const parsed = terrainCreateDocumentSchema.parse({
      kind: StockDocumentKind.BS,
      eventId: VALID_OID,
      tagCodes: ["TAG-MOB-0001"],
      bsSubtype: BsSubtype.BS_EVT,
    });
    expect(parsed.kind).toBe(StockDocumentKind.BS);
    expect(parsed.tagCodes).toEqual(["TAG-MOB-0001"]);
  });

  it("valide un BT inter-sites", () => {
    const parsed = terrainCreateDocumentSchema.parse({
      kind: StockDocumentKind.BT,
      fromWarehouseId: VALID_OID,
      toWarehouseId: OTHER_OID,
      tagCodes: ["TAG-A", "TAG-B"],
      btSubtype: BtSubtype.BT_SE,
    });
    expect(parsed.kind).toBe(StockDocumentKind.BT);
    if (parsed.kind === StockDocumentKind.BT) {
      expect(parsed.btSubtype).toBe(BtSubtype.BT_SE);
    }
  });

  it("rejette un eventId hors format ObjectId", () => {
    const result = terrainCreateDocumentSchema.safeParse({
      kind: StockDocumentKind.BS,
      eventId: "evt-demo-1",
      tagCodes: ["TAG-MOB-0001"],
    });
    expect(result.success).toBe(false);
  });

  it("accepte un ObjectId hex valide (erreur métier ensuite si mauvaise ressource)", () => {
    const result = terrainCreateDocumentSchema.safeParse({
      kind: StockDocumentKind.BS,
      eventId: "000000000000000000000090",
      tagCodes: ["TAG-MOB-0001"],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un BT sans tags", () => {
    const result = terrainCreateDocumentSchema.safeParse({
      kind: StockDocumentKind.BT,
      fromWarehouseId: VALID_OID,
      toWarehouseId: OTHER_OID,
      tagCodes: [],
    });
    expect(result.success).toBe(false);
  });
});
