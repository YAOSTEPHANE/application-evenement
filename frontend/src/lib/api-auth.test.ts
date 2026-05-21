import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiAuthError, assertSeedRequestAllowed, proxyAllowsSeed } from "@/lib/api-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertSeedRequestAllowed", () => {
  it("autorise le seed en développement sans secret", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() =>
      assertSeedRequestAllowed(new Request("http://localhost/api/setup/seed", { method: "POST" })),
    ).not.toThrow();
  });

  it("refuse le seed en production sans Bearer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_SECRET", "test-secret");
    expect(() =>
      assertSeedRequestAllowed(new Request("http://localhost/api/setup/seed", { method: "POST" })),
    ).toThrow(ApiAuthError);
  });

  it("autorise le seed en production avec le bon Bearer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_SECRET", "test-secret");
    expect(() =>
      assertSeedRequestAllowed(
        new Request("http://localhost/api/setup/seed", {
          method: "POST",
          headers: { Authorization: "Bearer test-secret" },
        }),
      ),
    ).not.toThrow();
  });
});

describe("proxyAllowsSeed", () => {
  it("retourne true en dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    const req = new Request("http://localhost/api/setup/seed");
    expect(proxyAllowsSeed(req as never)).toBe(true);
  });
});
