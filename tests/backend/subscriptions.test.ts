import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isActiveSubscriptionStatus,
  normalizeSubscriptionStatus,
  parseSubscriptionMetadata,
} from "../../lib/billing/subscriptions";

describe("billing subscription helpers", () => {
  it("treats trialing and active subscriptions as enabled", () => {
    assert.equal(isActiveSubscriptionStatus("trialing"), true);
    assert.equal(isActiveSubscriptionStatus("active"), true);
    assert.equal(isActiveSubscriptionStatus("past_due"), false);
    assert.equal(isActiveSubscriptionStatus("canceled"), false);
    assert.equal(isActiveSubscriptionStatus(null), false);
  });

  it("normalizes supported subscription statuses", () => {
    assert.equal(normalizeSubscriptionStatus("incomplete_expired"), "incomplete_expired");
    assert.equal(normalizeSubscriptionStatus("paused"), "paused");
    assert.equal(normalizeSubscriptionStatus("unknown"), null);
  });

  it("parses individual subscription metadata", () => {
    assert.deepEqual(
      parseSubscriptionMetadata({
        planKey: "individual",
        profileId: "user-123",
        scope: "individual",
      }),
      {
        planKey: "individual",
        profileId: "user-123",
        scope: "individual",
        teamId: null,
      }
    );
  });

  it("parses team subscription metadata from snake_case keys", () => {
    assert.deepEqual(
      parseSubscriptionMetadata({
        plan_key: "team",
        scope: "team",
        team_id: "team-123",
      }),
      {
        planKey: "team",
        profileId: null,
        scope: "team",
        teamId: "team-123",
      }
    );
  });

  it("rejects mismatched or incomplete metadata", () => {
    assert.equal(
      parseSubscriptionMetadata({
        planKey: "team",
        profileId: "user-123",
        scope: "individual",
      }),
      null
    );

    assert.equal(
      parseSubscriptionMetadata({
        planKey: "individual",
        scope: "individual",
      }),
      null
    );
  });
});
