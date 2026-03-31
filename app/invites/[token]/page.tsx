export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_60px_-40px_rgba(34,42,70,0.45)]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Team invite</p>
          <h1 className="text-3xl font-semibold tracking-tight">Invite acceptance scaffold</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This route will accept team invite tokens issued by the extension support backend and complete membership
            onboarding after auth.
          </p>
          <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            Invite token: <span className="font-mono text-foreground">{token}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

