import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamInviteAcceptedEmail, sendTeamInviteEmail, type EmailDeliveryResult } from "@/lib/email/transactional";

export type TeamInviteRole = "admin" | "member";
type TeamRole = "owner" | "admin" | "member";

export type TeamInviteRecord = {
  acceptedAt: string | null;
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  inviteUrl: string;
  invitedByUserId?: string | null;
  role: TeamInviteRole;
  teamId: string;
  teamName: string;
  token: string;
};

export type TeamInviteAcceptanceResult = {
  notification: EmailDeliveryResult | null;
  role: TeamRole;
  teamId: string;
  teamName: string;
};

export type CreateTeamInviteResult = {
  delivery: EmailDeliveryResult;
  invite: TeamInviteRecord;
};

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function createTeamInvite({
  appOrigin,
  email,
  inviterEmail,
  role,
  teamId,
  userId,
}: {
  appOrigin: string;
  email: string;
  inviterEmail: string | null;
  role: string;
  teamId: string;
  userId: string;
}): Promise<CreateTeamInviteResult> {
  const admin = createAdminClient();
  const normalizedEmail = normalizeInviteEmail(email);
  const normalizedRole = normalizeTeamInviteRole(role);
  const team = await requireInviteManager(admin, teamId, userId);
  const token = createInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS).toISOString();
  const existingInvite = await findOpenInviteByEmail(admin, teamId, normalizedEmail);

  const values = {
    email: normalizedEmail,
    expires_at: expiresAt,
    invited_by_user_id: userId,
    role: normalizedRole,
    team_id: teamId,
    token,
  };

  let inviteId = existingInvite?.id ?? null;

  if (existingInvite) {
    const { error } = await admin.from("team_invites").update(values).eq("id", existingInvite.id);

    if (error) {
      throw new Error(`Unable to update the team invite: ${error.message}`);
    }
  } else {
    const { data, error } = await admin
      .from("team_invites")
      .insert(values)
      .select("id")
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Unable to create the team invite: ${error.message}`);
    }

    inviteId = data.id;
  }

  const invite = {
    acceptedAt: null,
    createdAt: existingInvite?.created_at ?? new Date().toISOString(),
    email: normalizedEmail,
    expiresAt,
    id: inviteId ?? createInviteToken(),
    inviteUrl: buildInviteUrl(appOrigin, token),
    invitedByUserId: userId,
    role: normalizedRole,
    teamId,
    teamName: team.name,
    token,
  };

  const delivery = await sendTeamInviteEmail({
    expiresAt,
    inviteUrl: invite.inviteUrl,
    inviteeEmail: normalizedEmail,
    inviterEmail,
    role: normalizedRole,
    teamName: team.name,
    token,
  });

  return {
    delivery,
    invite,
  };
}

export async function acceptTeamInvite({
  token,
  userEmail,
  userId,
}: {
  token: string;
  userEmail: string | null | undefined;
  userId: string;
}): Promise<TeamInviteAcceptanceResult> {
  const admin = createAdminClient();
  const invite = await getTeamInviteByToken(token);

  if (invite.acceptedAt) {
    throw new Error("This invite has already been accepted.");
  }

  if (Date.parse(invite.expiresAt) <= Date.now()) {
    throw new Error("This invite has expired.");
  }

  const normalizedUserEmail = normalizeInviteEmail(userEmail ?? "");

  if (normalizedUserEmail !== invite.email) {
    throw new Error(`This invite was sent to ${invite.email}. Sign in with that email to accept it.`);
  }

  const existingMembership = await findExistingTeamMembership(admin, invite.teamId, userId);
  const nextRole = resolveMembershipRole(existingMembership?.role ?? null, invite.role);

  if (existingMembership) {
    const { error } = await admin
      .from("team_memberships")
      .update({
        role: nextRole,
      })
      .eq("team_id", invite.teamId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Unable to update the team membership: ${error.message}`);
    }
  } else {
    const { error } = await admin.from("team_memberships").insert({
      role: nextRole,
      team_id: invite.teamId,
      user_id: userId,
    });

    if (error) {
      throw new Error(`Unable to create the team membership: ${error.message}`);
    }
  }

  const { error: inviteError } = await admin
    .from("team_invites")
    .update({
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (inviteError) {
    throw new Error(`Unable to mark the invite as accepted: ${inviteError.message}`);
  }

  let notification: EmailDeliveryResult | null = null;

  try {
    const inviterEmail = invite.invitedByUserId ? await findProfileEmailById(admin, invite.invitedByUserId) : null;

    if (normalizedUserEmail && inviterEmail) {
      notification = await sendTeamInviteAcceptedEmail({
        acceptedEmail: normalizedUserEmail,
        inviterEmail,
        role: nextRole,
        teamName: invite.teamName,
      });
    }
  } catch (error) {
    console.error("Invite acceptance notification failed", error);
    notification = {
      message: "Invite acceptance notification failed.",
      providerMessageId: null,
      status: "failed",
    };
  }

  return {
    notification,
    role: nextRole,
    teamId: invite.teamId,
    teamName: invite.teamName,
  };
}

export async function getTeamInviteByToken(token: string): Promise<TeamInviteRecord> {
  const admin = createAdminClient();
  const normalizedToken = normalizeInviteToken(token);
  const { data, error } = await admin
    .from("team_invites")
    .select("id, team_id, email, role, token, invited_by_user_id, accepted_at, expires_at, created_at")
    .eq("token", normalizedToken)
    .limit(1)
    .maybeSingle<{
      accepted_at: string | null;
      created_at: string;
      email: string;
      expires_at: string;
      id: string;
      invited_by_user_id: string | null;
      role: TeamInviteRole;
      team_id: string;
      token: string;
    }>();

  if (error) {
    throw new Error(`Unable to load the team invite: ${error.message}`);
  }

  if (!data) {
    throw new Error("This invite could not be found.");
  }

  const team = await loadTeamSummary(admin, data.team_id);

  return {
    acceptedAt: data.accepted_at,
    createdAt: data.created_at,
    email: data.email,
    expiresAt: data.expires_at,
    id: data.id,
    inviteUrl: buildInviteUrl(process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.APP_URL?.trim() ?? "http://localhost:3000", data.token),
    invitedByUserId: data.invited_by_user_id,
    role: data.role,
    teamId: data.team_id,
    teamName: team.name,
    token: data.token,
  };
}

export function normalizeTeamInviteRole(value: string): TeamInviteRole {
  if (value === "admin" || value === "member") {
    return value;
  }

  throw new Error("Invite roles must be admin or member.");
}

export function normalizeInviteToken(value: string) {
  const token = value.trim();

  if (!token) {
    throw new Error("Invite token is required.");
  }

  return token;
}

export function normalizeInviteEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("A valid invite email is required.");
  }

  return email;
}

function buildInviteUrl(appOrigin: string, token: string) {
  return `${appOrigin.replace(/\/$/, "")}/invites/${token}`;
}

function createInviteToken() {
  return randomBytes(24).toString("hex");
}

async function requireInviteManager(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  userId: string
) {
  const membership = await findExistingTeamMembership(admin, teamId, userId);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Only team owners and admins can manage invites.");
  }

  return loadTeamSummary(admin, teamId);
}

async function findOpenInviteByEmail(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  email: string
) {
  const { data, error } = await admin
    .from("team_invites")
    .select("id, created_at")
    .eq("team_id", teamId)
    .eq("email", email)
    .is("accepted_at", null)
    .limit(1)
    .maybeSingle<{ created_at: string; id: string }>();

  if (error) {
    throw new Error(`Unable to load existing invites: ${error.message}`);
  }

  return data ?? null;
}

async function findExistingTeamMembership(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  userId: string
) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ role: TeamRole }>();

  if (error) {
    throw new Error(`Unable to load the team membership: ${error.message}`);
  }

  return data ?? null;
}

async function findProfileEmailById(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .limit(1)
    .maybeSingle<{ email: string }>();

  if (error) {
    throw new Error(`Unable to load the inviter profile: ${error.message}`);
  }

  return data?.email ?? null;
}

async function loadTeamSummary(admin: ReturnType<typeof createAdminClient>, teamId: string) {
  const { data, error } = await admin
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();

  if (error) {
    throw new Error(`Unable to load the team details: ${error.message}`);
  }

  if (!data) {
    throw new Error("The requested team could not be found.");
  }

  return data;
}

function resolveMembershipRole(currentRole: TeamRole | null, invitedRole: TeamInviteRole): TeamRole {
  if (!currentRole) {
    return invitedRole;
  }

  const rank = {
    admin: 2,
    member: 1,
    owner: 3,
  } satisfies Record<TeamRole, number>;

  return rank[currentRole] >= rank[invitedRole] ? currentRole : invitedRole;
}
