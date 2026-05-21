import { describe, expect, it } from "vitest";

import {
  newOfflineTempDocumentId,
  resolveOfflineDocumentId,
} from "@/lib/offline-id";

describe("offline-id", () => {
  it("génère un id temporaire préfixé temp_", () => {
    const id = newOfflineTempDocumentId();
    expect(id.startsWith("temp_")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it("remappe les ids après sync create_document", () => {
    const temp = "temp_abc";
    const server = "507f1f77bcf86cd799439011";
    expect(resolveOfflineDocumentId(temp, { [temp]: server })).toBe(server);
    expect(resolveOfflineDocumentId(server, { [temp]: server })).toBe(server);
  });

  it("retourne undefined si documentId absent", () => {
    expect(resolveOfflineDocumentId(undefined, {})).toBeUndefined();
  });
});
