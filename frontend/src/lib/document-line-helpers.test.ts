import { describe, expect, it } from "vitest";

import { documentLinesRfidComplete } from "@/lib/document-line-helpers";

describe("documentLinesRfidComplete", () => {
  it("retourne false si aucune ligne", () => {
    expect(documentLinesRfidComplete([])).toBe(false);
  });

  it("retourne true si chaque ligne est entièrement scannée", () => {
    expect(
      documentLinesRfidComplete([
        { expectedQty: 2, scannedQty: 2 },
        { expectedQty: 1, scannedQty: 1 },
      ]),
    ).toBe(true);
  });

  it("retourne false si scan incomplet", () => {
    expect(documentLinesRfidComplete([{ expectedQty: 3, scannedQty: 1 }])).toBe(false);
  });
});
