import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTeamInviteAcceptedEmail,
  buildTeamInviteEmail,
  resolveEmailRuntimeConfig,
} from "../../lib/email/transactional";

describe("transactional email helpers", () => {
  it("marks email delivery as unconfigured when resend env vars are missing", () => {
    const config = resolveEmailRuntimeConfig({
      APP_NAME: "Prompt Dock",
      APP_URL: "http://localhost:3000",
      EMAIL_FROM: "",
      NEXT_PUBLIC_APP_URL: "",
      RESEND_API_KEY: "",
    } as NodeJS.ProcessEnv);

    assert.equal(config.configured, false);
    assert.equal(config.appName, "Prompt Dock");
    assert.equal(config.appUrl, "http://localhost:3000");
  });

  it("builds invite email content with link and token", () => {
    const email = buildTeamInviteEmail({
      expiresAt: "2026-04-15T00:00:00.000Z",
      inviteUrl: "http://localhost:3000/invites/token-123",
      inviteeEmail: "person@example.com",
      inviterEmail: "owner@example.com",
      role: "admin",
      teamName: "Acme Writers",
      token: "token-123",
    });

    assert.match(email.subject, /owner@example.com invited you to Acme Writers/);
    assert.match(email.text, /token-123/);
    assert.match(email.html, /Open invite/);
  });

  it("builds invite acceptance notification content", () => {
    const email = buildTeamInviteAcceptedEmail({
      acceptedEmail: "member@example.com",
      role: "member",
      teamName: "Acme Writers",
    });

    assert.match(email.subject, /member@example.com joined Acme Writers/);
    assert.match(email.text, /team member access/);
    assert.match(email.html, /Invite accepted/);
  });
});
