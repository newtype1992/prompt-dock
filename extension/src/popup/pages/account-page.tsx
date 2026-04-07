import { ToggleChip } from "../components";

export function AccountPage({
  accountEmail,
  authEmail,
  authIntent,
  authPassword,
  cloudConfigured,
  isAuthSubmitting,
  isRefreshingCloud,
  lastSyncedAt,
  libraryMode,
  onChangeAuthEmail,
  onChangeAuthIntent,
  onChangeAuthPassword,
  onRefreshCloud,
  onSignOut,
  onSubmitAuth,
}: {
  accountEmail: string | null;
  authEmail: string;
  authIntent: "signIn" | "signUp";
  authPassword: string;
  cloudConfigured: boolean;
  isAuthSubmitting: boolean;
  isRefreshingCloud: boolean;
  lastSyncedAt: string | null;
  libraryMode: "local" | "cloud";
  onChangeAuthEmail: (value: string) => void;
  onChangeAuthIntent: (value: "signIn" | "signUp") => void;
  onChangeAuthPassword: (value: string) => void;
  onRefreshCloud: () => void;
  onSignOut: () => void;
  onSubmitAuth: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const accountSignedIn = Boolean(accountEmail);

  return (
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
              {isRefreshingCloud ? "Refreshing..." : "Sync now"}
            </button>
          ) : null}
        </div>

        {!cloudConfigured ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable cloud auth and sync in the
            extension.
          </div>
        ) : accountSignedIn ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Signed in as</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{accountEmail}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {libraryMode === "cloud"
                    ? `Cloud sync active${lastSyncedAt ? ` | last synced ${formatRelativeSyncTime(lastSyncedAt)}` : ""}`
                    : "Signed in, but using a local fallback until cloud refresh succeeds."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={isAuthSubmitting}
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
                Signing in switches Prompt Dock from free local mode to a personal Supabase-backed library.
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
