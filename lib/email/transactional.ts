import { Resend } from "resend";

export type EmailDeliveryStatus = "sent" | "disabled" | "failed";

export type EmailDeliveryResult = {
  message: string;
  providerMessageId: string | null;
  status: EmailDeliveryStatus;
};

export function resolveEmailRuntimeConfig(env: NodeJS.ProcessEnv) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";
  const appName = env.APP_NAME?.trim() || "Prompt Dock";
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || env.APP_URL?.trim() || "http://localhost:3000";

  return {
    apiKey,
    appName,
    appUrl,
    configured: Boolean(apiKey && from),
    from,
  };
}

export async function sendTeamInviteEmail({
  expiresAt,
  inviteUrl,
  inviteeEmail,
  inviterEmail,
  teamName,
  token,
  role,
}: {
  expiresAt: string;
  inviteUrl: string;
  inviteeEmail: string;
  inviterEmail: string | null;
  role: "admin" | "member";
  teamName: string;
  token: string;
}): Promise<EmailDeliveryResult> {
  return sendEmail({
    disabledMessage: "Invite email delivery is not configured. Share the invite link manually.",
    failureMessage: `Invite email delivery failed for ${inviteeEmail}. Share the invite link manually.`,
    payload: buildTeamInviteEmail({
      expiresAt,
      inviteUrl,
      inviteeEmail,
      inviterEmail,
      role,
      teamName,
      token,
    }),
    replyTo: inviterEmail,
  });
}

export async function sendTeamInviteAcceptedEmail({
  acceptedEmail,
  inviterEmail,
  role,
  teamName,
}: {
  acceptedEmail: string;
  inviterEmail: string | null;
  role: "owner" | "admin" | "member";
  teamName: string;
}): Promise<EmailDeliveryResult> {
  if (!inviterEmail || inviterEmail.trim().toLowerCase() === acceptedEmail.trim().toLowerCase()) {
    return {
      message: "Invite acceptance notification skipped because no separate inviter email is available.",
      providerMessageId: null,
      status: "disabled",
    };
  }

  return sendEmail({
    disabledMessage: "Invite acceptance notifications are not configured.",
    failureMessage: `Invite acceptance notification failed for ${inviterEmail}.`,
    payload: buildTeamInviteAcceptedEmail({
      acceptedEmail,
      role,
      teamName,
    }),
    to: inviterEmail,
  });
}

export function buildTeamInviteEmail({
  expiresAt,
  inviteUrl,
  inviteeEmail,
  inviterEmail,
  role,
  teamName,
  token,
}: {
  expiresAt: string;
  inviteUrl: string;
  inviteeEmail: string;
  inviterEmail: string | null;
  role: "admin" | "member";
  teamName: string;
  token: string;
}) {
  const config = resolveEmailRuntimeConfig(process.env);
  const inviterLabel = inviterEmail?.trim() ? inviterEmail.trim() : `${config.appName} team admin`;
  const roleLabel = formatInviteRole(role);
  const expiresLabel = formatDateForEmail(expiresAt);
  const subject = `${inviterLabel} invited you to ${teamName} on ${config.appName}`;

  const text = [
    `Join ${teamName} on ${config.appName}`,
    "",
    `${inviterLabel} invited ${inviteeEmail} to join ${teamName} as a ${roleLabel}.`,
    `Accept the invite in the ${config.appName} extension using this link:`,
    inviteUrl,
    "",
    `Invite token: ${token}`,
    `Expires: ${expiresLabel}`,
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">`,
    `<p style="margin:0 0 16px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#0891b2">${escapeHtml(config.appName)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:24px;color:#0f172a">Join ${escapeHtml(teamName)}</h1>`,
    `<p style="margin:0 0 16px">${escapeHtml(inviterLabel)} invited <strong>${escapeHtml(inviteeEmail)}</strong> to join <strong>${escapeHtml(teamName)}</strong> as a ${escapeHtml(roleLabel)}.</p>`,
    `<p style="margin:0 0 20px">Open the invite in Prompt Dock and accept it from the extension account page.</p>`,
    `<p style="margin:0 0 20px"><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;border-radius:12px;background:#0f172a;padding:12px 18px;color:#ffffff;text-decoration:none;font-weight:600">Open invite</a></p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#475569">Invite link: <a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#475569">Token: <code>${escapeHtml(token)}</code></p>`,
    `<p style="margin:0;font-size:13px;color:#475569">Expires ${escapeHtml(expiresLabel)}.</p>`,
    `</div>`,
  ].join("");

  return {
    html,
    subject,
    text,
    to: inviteeEmail,
  };
}

export function buildTeamInviteAcceptedEmail({
  acceptedEmail,
  role,
  teamName,
}: {
  acceptedEmail: string;
  role: "owner" | "admin" | "member";
  teamName: string;
}) {
  const config = resolveEmailRuntimeConfig(process.env);
  const roleLabel = formatMembershipRole(role);
  const subject = `${acceptedEmail} joined ${teamName} on ${config.appName}`;

  const text = [
    `${acceptedEmail} accepted the invite to ${teamName}.`,
    "",
    `They now have ${roleLabel} access in ${config.appName}.`,
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">`,
    `<p style="margin:0 0 16px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#0891b2">${escapeHtml(config.appName)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:24px;color:#0f172a">Invite accepted</h1>`,
    `<p style="margin:0 0 12px"><strong>${escapeHtml(acceptedEmail)}</strong> accepted the invite to <strong>${escapeHtml(teamName)}</strong>.</p>`,
    `<p style="margin:0">They now have ${escapeHtml(roleLabel)} access.</p>`,
    `</div>`,
  ].join("");

  return {
    html,
    subject,
    text,
    to: "",
  };
}

async function sendEmail({
  disabledMessage,
  failureMessage,
  payload,
  replyTo,
  to,
}: {
  disabledMessage: string;
  failureMessage: string;
  payload: {
    html: string;
    subject: string;
    text: string;
    to: string;
  };
  replyTo?: string | null;
  to?: string;
}): Promise<EmailDeliveryResult> {
  const config = resolveEmailRuntimeConfig(process.env);

  if (!config.configured) {
    return {
      message: disabledMessage,
      providerMessageId: null,
      status: "disabled",
    };
  }

  try {
    const resend = new Resend(config.apiKey);
    const response = await resend.emails.send({
      from: config.from,
      html: payload.html,
      replyTo: replyTo?.trim() || undefined,
      subject: payload.subject,
      text: payload.text,
      to: to ?? payload.to,
    });

    if (response.error) {
      console.error("Resend email send failed", response.error);
      return {
        message: failureMessage,
        providerMessageId: null,
        status: "failed",
      };
    }

    return {
      message: "Email sent.",
      providerMessageId: response.data?.id ?? null,
      status: "sent",
    };
  } catch (error) {
    console.error("Resend email send threw", error);

    return {
      message: failureMessage,
      providerMessageId: null,
      status: "failed",
    };
  }
}

function formatInviteRole(role: "admin" | "member") {
  return role === "admin" ? "team admin" : "team member";
}

function formatMembershipRole(role: "owner" | "admin" | "member") {
  if (role === "owner") {
    return "owner";
  }

  return formatInviteRole(role);
}

function formatDateForEmail(value: string) {
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
