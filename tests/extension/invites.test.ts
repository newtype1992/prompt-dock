import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInviteUrl, extractInviteToken } from "../../extension/src/lib/invites";

describe("extension invite helpers", () => {
  it("extracts tokens from full support app invite urls", () => {
    const inviteUrl = buildInviteUrl("invite-token-123");

    assert.equal(extractInviteToken(inviteUrl), "invite-token-123");
  });

  it("accepts raw invite tokens", () => {
    assert.equal(extractInviteToken("invite-token-456"), "invite-token-456");
  });

  it("rejects blank values", () => {
    assert.throws(() => extractInviteToken("   "), /Paste an invite link or token first/);
  });
});
