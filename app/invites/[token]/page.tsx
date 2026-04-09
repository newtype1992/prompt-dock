import { getTeamInviteByToken } from "@/lib/team-invites";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    const invite = await getTeamInviteByToken(token);
    const expired = Date.parse(invite.expiresAt) <= Date.now();

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <section className="w-full rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_60px_-40px_rgba(34,42,70,0.45)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Team invite</p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {invite.acceptedAt ? "Invite already accepted" : expired ? "Invite expired" : `Join ${invite.teamName}`}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {invite.acceptedAt
                  ? "This invite link has already been used."
                  : expired
                    ? "This invite has passed its expiry window. Ask the team owner or admin to send a fresh invite."
                    : `${invite.email} was invited to ${invite.teamName} as a ${formatInviteRole(invite.role)}.`}
              </p>
            </div>

            {!invite.acceptedAt && !expired ? (
              <>
                <div className="rounded-2xl border border-border bg-background/80 px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">How to accept</p>
                  <ol className="mt-2 list-decimal space-y-2 pl-5">
                    <li>Open the Prompt Dock extension.</li>
                    <li>Sign in or create an account using <span className="font-medium text-foreground">{invite.email}</span>.</li>
                    <li>Go to the Account page and paste this invite link or token into the Join team form.</li>
                  </ol>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-background/80 px-4 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invite link</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">{invite.inviteUrl}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Token</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">{invite.token}</p>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Expires {formatCalendarDate(invite.expiresAt)}.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
    );
  } catch (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <section className="w-full rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_60px_-40px_rgba(34,42,70,0.45)]">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Team invite</p>
            <h1 className="text-3xl font-semibold tracking-tight">Invite unavailable</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {error instanceof Error ? error.message : "This invite could not be loaded."}
            </p>
          </div>
        </section>
      </main>
    );
  }
}

function formatInviteRole(role: "admin" | "member") {
  return role === "admin" ? "team admin" : "team member";
}

function formatCalendarDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
