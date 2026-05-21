import { describe, expect, it } from "vitest";

import { IDEMPOTENCY_HEADER, readIdempotencyKey } from "@/lib/api-idempotency";

describe("readIdempotencyKey", () => {
  it("lit idempotency-key en minuscules", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { [IDEMPOTENCY_HEADER]: "create:tmp_1" },
    });
    expect(readIdempotencyKey(req)).toBe("create:tmp_1");
  });

  it("lit Idempotency-Key (casse mobile)", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { "Idempotency-Key": "scan:doc_abc" },
    });
    expect(readIdempotencyKey(req)).toBe("scan:doc_abc");
  });

  it("retourne null si absent", () => {
    expect(readIdempotencyKey(new Request("http://localhost/api/x"))).toBeNull();
  });
});
