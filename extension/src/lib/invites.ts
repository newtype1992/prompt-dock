import { resolveSupportAppRuntimeConfig } from "./runtime-config";
import { getExtensionSupabaseClient } from "./supabase";
import type { TeamInviteRole, TeamInviteSummary } from "./types";

const supportAppRuntimeConfig = resolveSupportAppRuntimeConfig(getRuntimeEnv());

export type AcceptInviteResult = {
  role: "owner" | "admin" | "member";
  teamId: string;
  teamName: string;
};

export async function createTeamInviteRequest({
  email,
  role,
  teamId,
}: {
  email: string;
  role: TeamInviteRole;
  teamId: string;
}) {
  const payload = await callSupportApp<{
    invite: TeamInviteSummary & {
      teamId: string;
      teamName: string;
      acceptedAt: string | null;
    };
  }>("/api/team-invites", {
    body: JSON.stringify({
      email,
      role,
      teamId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return payload.invite;
}

export async function acceptTeamInviteRequest(token: string) {
  const payload = await callSupportApp<{
    result: AcceptInviteResult;
  }>("/api/team-invites/accept", {
    body: JSON.stringify({
      token,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return payload.result;
}

export function buildInviteUrl(token: string) {
  return `${supportAppRuntimeConfig.url}/invites/${token}`;
}

export function extractInviteToken(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Paste an invite link or token first.");
  }

  try {
    const url = new URL(trimmed);
    const supportAppUrl = new URL(supportAppRuntimeConfig.url);

    if (url.origin === supportAppUrl.origin) {
      const match = url.pathname.match(/^\/invites\/([^/]+)$/);

      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    // Treat the raw value as the token when it is not a URL.
  }

  return trimmed;
}

async function callSupportApp<TPayload>(
  path: string,
  init: {
    body?: BodyInit;
    headers?: HeadersInit;
    method: "POST";
  }
) {
  const client = getExtensionSupabaseClient();

  if (!client) {
    throw new Error("Team invites are unavailable until the support app and Supabase are configured.");
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sign in before managing team invites.");
  }

  const response = await fetch(`${supportAppRuntimeConfig.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | (TPayload & {
        message?: string;
        ok?: boolean;
      })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.message ?? "The invite request could not be completed.");
  }

  return payload;
}

function getRuntimeEnv() {
  return ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}) as Record<
    string,
    string | undefined
  >;
}
