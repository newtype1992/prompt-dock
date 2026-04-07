import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSupabaseRuntimeConfig } from "../../extension/src/lib/runtime-config";

describe("extension runtime config", () => {
  it("marks Supabase as configured when both public values exist", () => {
    const config = resolveSupabaseRuntimeConfig({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });

    assert.equal(config.configured, true);
    assert.equal(config.url, "http://127.0.0.1:54321");
    assert.equal(config.anonKey, "public-anon-key");
    assert.deepEqual(config.missing, []);
  });

  it("reports missing fields when env vars are absent", () => {
    const config = resolveSupabaseRuntimeConfig({});

    assert.equal(config.configured, false);
    assert.deepEqual(config.missing, ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  });
});
