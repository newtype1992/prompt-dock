import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeInviteEmail, normalizeInviteToken, normalizeTeamInviteRole } from "../../lib/team-invites";

describe("team invite helpers", () => {
  it("normalizes supported invite roles", () => {
    assert.equal(normalizeTeamInviteRole("admin"), "admin");
    assert.equal(normalizeTeamInviteRole("member"), "member");
    assert.throws(() => normalizeTeamInviteRole("owner"), /admin or member/);
  });

  it("normalizes invite emails to lowercase", () => {
    assert.equal(normalizeInviteEmail(" Person@Company.com "), "person@company.com");
    assert.throws(() => normalizeInviteEmail("not-an-email"), /valid invite email/);
  });

  it("rejects blank invite tokens", () => {
    assert.equal(normalizeInviteToken(" invite-token "), "invite-token");
    assert.throws(() => normalizeInviteToken("  "), /Invite token is required/);
  });
});
