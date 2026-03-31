import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PLAN_KEYS, SUPPORTED_SITES, TEAM_ROLES } from "../../lib/product/config";

describe("Prompt Dock scaffold", () => {
  it("defines the agreed product constants", () => {
    assert.deepEqual(PLAN_KEYS, ["free", "individual", "team"]);
    assert.deepEqual(TEAM_ROLES, ["owner", "admin", "member"]);
    assert.deepEqual(SUPPORTED_SITES, ["ChatGPT", "Claude", "Gemini", "Perplexity"]);
  });

  it("includes the initial Supabase migration", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase",
      "migrations",
      "20260331000100_initial_prompt_dock_schema.sql"
    );

    assert.equal(existsSync(migrationPath), true);
  });
});
