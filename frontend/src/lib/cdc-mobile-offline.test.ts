import { describe, expect, it } from "vitest";

import { CDC_OFFLINE_CRITICAL_ACTIONS, getMobileOfflineSpec } from "@/lib/cdc-mobile-offline";

describe("getMobileOfflineSpec", () => {
  it("expose les actions hors ligne dont BT et BS", () => {
    const spec = getMobileOfflineSpec();
    const ids = spec.criticalActions.map((a) => a.id);
    expect(ids).toContain("create_document");
    expect(ids).toContain("create_bt");
    expect(ids).toContain("scan");
    expect(spec.platforms).toEqual(["ios", "android"]);
    expect(CDC_OFFLINE_CRITICAL_ACTIONS.length).toBeGreaterThanOrEqual(8);
  });
});
