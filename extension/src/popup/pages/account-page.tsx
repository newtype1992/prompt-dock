import {
  isActiveSubscriptionStatus,
  type SubscriptionPlanKey,
  type SubscriptionStatus,
} from "@/lib/billing/subscriptions";
import type { PromptWorkspace } from "../../lib/types";
import { formatTeamRole } from "../../lib/workspaces";
import { ToggleChip } from "../components";

export function AccountPage({
  accountEmail,
  activeWorkspace,
  activeWorkspaceId,
  authEmail,
  authIntent,
  authPassword,
  billingCurrentPeriodEnd,
  billingPlanKey,
  billingStatus,
  cloudConfigured,
  isAuthSubmitting,
  isBillingSubmitting,
  isInviteAccepting,
  isInviteSubmitting,
  isRefreshingCloud,
  isTeamSubmitting,
  inviteEmail,
  inviteInput,
  inviteRole,
  lastSyncedAt,
  libraryMode,
  teamName,
  teamInvites,
  workspaces,
  onChangeAuthEmail,
  onChangeAuthIntent,
  onChangeAuthPassword,
  onChangeInviteEmail,
  onChangeInviteInput,
  onChangeInviteRole,
  onChangeTeamName,
  onCopyInviteLink,
  onCreateInvite,
  onCreateTeam,
  onAcceptInvite,
  onOpenBillingPortal,
  onOpenCheckout,
  onOpenTeamBillingPortal,
  onOpenTeamCheckout,
  onRefreshCloud,
  onSelectWorkspace,
  onSignOut,
  onSubmitAuth,
}: {
  accountEmail: string | null;
  activeWorkspace: PromptWorkspace;
  activeWorkspaceId: string;
  authEmail: string;
  authIntent: "signIn" | "signUp";
  authPassword: string;
  billingCurrentPeriodEnd: string | null;
  billingPlanKey: SubscriptionPlanKey | null;
  billingStatus: SubscriptionStatus | null;
  cloudConfigured: boolean;
  isAuthSubmitting: boolean;
  isBillingSubmitting: boolean;
  isInviteAccepting: boolean;
  isInviteSubmitting: boolean;
  isRefreshingCloud: boolean;
  isTeamSubmitting: boolean;
  inviteEmail: string;
  inviteInput: string;
  inviteRole: "admin" | "member";
  lastSyncedAt: string | null;
  libraryMode: "local" | "cloud";
  teamName: string;
  teamInvites: Array<{
    createdAt: string;
    email: string;
    expiresAt: string;
    id: string;
    inviteUrl: string;
    role: "admin" | "member";
    token: string;
  }>;
  workspaces: PromptWorkspace[];
  onChangeAuthEmail: (value: string) => void;
  onChangeAuthIntent: (value: "signIn" | "signUp") => void;
  onChangeAuthPassword: (value: string) => void;
  onChangeInviteEmail: (value: string) => void;
  onChangeInviteInput: (value: string) => void;
  onChangeInviteRole: (value: "admin" | "member") => void;
  onChangeTeamName: (value: string) => void;
  onCopyInviteLink: (inviteUrl: string, email: string) => void;
  onCreateInvite: (event: React.FormEvent<HTMLFormElement>) => void;
  onCreateTeam: (event: React.FormEvent<HTMLFormElement>) => void;
  onAcceptInvite: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenBillingPortal: () => void;
  onOpenCheckout: () => void;
  onOpenTeamBillingPortal: (workspace: PromptWorkspace) => void;
  onOpenTeamCheckout: (workspace: PromptWorkspace) => void;
  onRefreshCloud: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onSignOut: () => void;
  onSubmitAuth: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const accountSignedIn = Boolean(accountEmail);
  const hasActivePersonalPlan = billingPlanKey === "individual" && isActiveSubscriptionStatus(billingStatus);
  const teamWorkspaces = workspaces.filter((workspace) => workspace.kind === "team");
  const canManageActiveTeamInvites =
    activeWorkspace.kind === "team" && (activeWorkspace.role === "owner" || activeWorkspace.role === "admin");

  return (
    <div className="grid gap-4">
      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Account</p>
              <h2 className="mt-1 text-lg font-semibold">
                {accountSignedIn ? "Cloud sync account" : cloudConfigured ? "Enable personal cloud sync" : "Cloud sync setup"}
              </h2>
            </div>
            {accountSignedIn ? (
              <button
                type="button"
                onClick={onRefreshCloud}
                disabled={isRefreshingCloud}
                className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshingCloud ? "Refreshing..." : hasActivePersonalPlan ? "Sync now" : "Refresh status"}
              </button>
            ) : null}
          </div>

          {!cloudConfigured ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable cloud auth and sync in the
              extension.
            </div>
          ) : accountSignedIn ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="space-y-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Signed in as</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{accountEmail}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {libraryMode === "cloud"
                      ? `Cloud sync active${lastSyncedAt ? ` | last synced ${formatRelativeSyncTime(lastSyncedAt)}` : ""}`
                      : hasActivePersonalPlan
                        ? "Signed in, but using a local fallback until cloud refresh succeeds."
                        : "Signed in, but local mode stays active until an individual plan is active."}
                  </p>
                </div>

                <div
                  className={`rounded-[22px] border px-4 py-4 ${
                    hasActivePersonalPlan
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Billing</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {hasActivePersonalPlan ? "Individual plan active" : "No active individual plan"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {getBillingSummaryText({
                      billingCurrentPeriodEnd,
                      billingStatus,
                      hasActivePersonalPlan,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={hasActivePersonalPlan ? onOpenBillingPortal : onOpenCheckout}
                    disabled={isBillingSubmitting}
                    className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      hasActivePersonalPlan
                        ? "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                        : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {isBillingSubmitting
                      ? "Opening..."
                      : hasActivePersonalPlan
                        ? "Manage billing"
                        : "Upgrade to individual"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={isAuthSubmitting || isBillingSubmitting}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign out
              </button>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={onSubmitAuth}>
              <div className="flex flex-wrap gap-2">
                <ToggleChip active={authIntent === "signIn"} label="Sign in" onClick={() => onChangeAuthIntent("signIn")} />
                <ToggleChip
                  active={authIntent === "signUp"}
                  label="Create account"
                  onClick={() => onChangeAuthIntent("signUp")}
                />
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Email</span>
                <input
                  value={authEmail}
                  onChange={(event) => onChangeAuthEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Password</span>
                <input
                  value={authPassword}
                  onChange={(event) => onChangeAuthPassword(event.target.value)}
                  type="password"
                  autoComplete={authIntent === "signIn" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters with letters and digits"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">
                  Signing in keeps your local library available. Personal cloud sync unlocks once an individual plan is
                  active.
                </p>
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAuthSubmitting ? "Working..." : authIntent === "signIn" ? "Sign in" : "Create account"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {accountSignedIn ? (
        <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Workspaces</p>
              <h2 className="mt-1 text-lg font-semibold">Personal and shared libraries</h2>
            </div>

            <div className="grid gap-3">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {workspace.kind === "team" ? workspace.label : "Personal"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {getWorkspaceCardSummary(workspace)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectWorkspace(workspace.id)}
                        disabled={workspace.id === activeWorkspaceId}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {workspace.id === activeWorkspaceId ? "Active" : "Open"}
                      </button>
                      {workspace.kind === "team" ? (
                        renderTeamBillingButton({
                          isBillingSubmitting,
                          onOpenTeamBillingPortal,
                          onOpenTeamCheckout,
                          workspace,
                        })
                      ) : null}
                    </div>
                  </div>
                  {workspace.kind === "team" ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {getTeamBillingCaption(workspace)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <form className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4" onSubmit={onCreateTeam}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Create team</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create a shared team workspace and manage billing, membership, and invite flows from the extension.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={teamName}
                  onChange={(event) => onChangeTeamName(event.target.value)}
                  placeholder="Acme editorial team"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={isTeamSubmitting}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isTeamSubmitting ? "Creating..." : "Create team"}
                </button>
              </div>
            </form>

            {!teamWorkspaces.length ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                No team workspaces yet. Create one here, then switch into it from the library page.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {accountSignedIn ? (
        <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Invites</p>
              <h2 className="mt-1 text-lg font-semibold">Join or share team workspaces</h2>
            </div>

            <form className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4" onSubmit={onAcceptInvite}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Join team</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Paste the full invite link or just the token from a Prompt Dock team invite.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={inviteInput}
                  onChange={(event) => onChangeInviteInput(event.target.value)}
                  placeholder="https://promptdock.example.com/invites/... or token"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={isInviteAccepting}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInviteAccepting ? "Joining..." : "Join team"}
                </button>
              </div>
            </form>

            {canManageActiveTeamInvites ? (
              <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Invite teammates</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {activeWorkspace.kind === "team"
                      ? `Create invites for ${activeWorkspace.label}. Prompt Dock emails invite links when Resend is configured and still lets you copy links manually.`
                      : "Switch into a team workspace to invite teammates."}
                  </p>
                </div>

                <form className="grid gap-3" onSubmit={onCreateInvite}>
                  <input
                    value={inviteEmail}
                    onChange={(event) => onChangeInviteEmail(event.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                  />
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip active={inviteRole === "member"} label="Member" onClick={() => onChangeInviteRole("member")} />
                    <ToggleChip active={inviteRole === "admin"} label="Admin" onClick={() => onChangeInviteRole("admin")} />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isInviteSubmitting}
                      className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isInviteSubmitting ? "Creating..." : "Create invite"}
                    </button>
                  </div>
                </form>

                <div className="grid gap-2">
                  {teamInvites.length ? (
                    teamInvites.map((invite) => (
                      <div key={invite.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{invite.email}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {formatTeamRole(invite.role)} invite. Expires {formatCalendarDate(invite.expiresAt)}.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCopyInviteLink(invite.inviteUrl, invite.email)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                          >
                            Copy link
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                      No pending invites for this team workspace yet.
                    </div>
                  )}
                </div>
              </div>
            ) : activeWorkspace.kind === "team" ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                Only team owners and admins can create invites for {activeWorkspace.label}.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatRelativeSyncTime(value: string) {
  const difference = Date.now() - Date.parse(value);

  if (difference < 60_000) {
    return "just now";
  }

  const minutes = Math.round(difference / 60_000);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function getBillingSummaryText({
  billingCurrentPeriodEnd,
  billingStatus,
  hasActivePersonalPlan,
}: {
  billingCurrentPeriodEnd: string | null;
  billingStatus: SubscriptionStatus | null;
  hasActivePersonalPlan: boolean;
}) {
  if (!billingStatus) {
    return "No individual subscription is on file yet. Cloud sync stays in local mode until billing becomes active.";
  }

  const statusLabel = billingStatus.replaceAll("_", " ");
  const periodLabel = billingCurrentPeriodEnd ? ` Current period ends ${formatCalendarDate(billingCurrentPeriodEnd)}.` : "";

  if (hasActivePersonalPlan) {
    return `Billing status: ${statusLabel}.${periodLabel}`;
  }

  return `Billing status: ${statusLabel}. Cloud sync is gated until the plan returns to active or trialing.${periodLabel}`;
}

function formatCalendarDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getWorkspaceCardSummary(workspace: PromptWorkspace) {
  if (workspace.kind === "personal") {
    return workspace.mode === "cloud" ? "Paid personal sync workspace." : "Free local personal workspace.";
  }

  const roleLabel = workspace.role ? formatTeamRole(workspace.role) : "Member";

  if (workspace.access !== "ready") {
    return `${roleLabel}. ${workspace.accessNotice ?? "Waiting on team billing."}`;
  }

  if (!workspace.canEdit) {
    return `${roleLabel}. Shared library is active in read-only mode.`;
  }

  return `${roleLabel}. Shared library is active and editable.`;
}

function getTeamBillingCaption(workspace: PromptWorkspace) {
  if (workspace.role === "owner") {
    return workspace.access === "ready"
      ? "You own this team and can manage the shared plan."
      : "You own this team. Activate billing to unlock the shared library.";
  }

  return "Only the team owner can manage billing.";
}

function renderTeamBillingButton({
  isBillingSubmitting,
  onOpenTeamBillingPortal,
  onOpenTeamCheckout,
  workspace,
}: {
  isBillingSubmitting: boolean;
  onOpenTeamBillingPortal: (workspace: PromptWorkspace) => void;
  onOpenTeamCheckout: (workspace: PromptWorkspace) => void;
  workspace: PromptWorkspace;
}) {
  if (workspace.role !== "owner") {
    return null;
  }

  const hasActiveTeamPlan = workspace.access === "ready";

  return (
    <button
      type="button"
      onClick={() => (hasActiveTeamPlan ? onOpenTeamBillingPortal(workspace) : onOpenTeamCheckout(workspace))}
      disabled={isBillingSubmitting}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        hasActiveTeamPlan
          ? "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      {isBillingSubmitting ? "Opening..." : hasActiveTeamPlan ? "Manage team billing" : "Upgrade team"}
    </button>
  );
}
