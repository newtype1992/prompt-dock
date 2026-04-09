export default async function AuthSupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    flow?: string;
    scope?: string;
    status?: string;
    teamId?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const billingScope =
    resolvedSearchParams.flow === "billing" &&
    (resolvedSearchParams.scope === "individual" || resolvedSearchParams.scope === "team")
      ? resolvedSearchParams.scope
      : "individual";
  const billingStatus =
    resolvedSearchParams.flow === "billing" &&
    (resolvedSearchParams.status === "success" ||
      resolvedSearchParams.status === "canceled" ||
      resolvedSearchParams.status === "portal")
      ? resolvedSearchParams.status
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_60px_-40px_rgba(34,42,70,0.45)]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {billingStatus ? "Billing return" : "Auth support"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {billingStatus ? getBillingTitle(billingStatus, billingScope) : "This surface is reserved for extension auth flows."}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {billingStatus
              ? getBillingDescription(billingStatus, billingScope)
              : "Prompt Dock is extension-first. This page exists so the extension can hand off authentication-related flows to a hosted support surface without turning the web app into the main product."}
          </p>
          {billingStatus ? (
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              Return to the Prompt Dock extension and use the account page to confirm the latest billing state.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function getBillingTitle(status: "success" | "canceled" | "portal", scope: "individual" | "team") {
  const targetLabel = scope === "team" ? "Team checkout" : "Checkout";

  if (status === "success") {
    return `${targetLabel} completed`;
  }

  if (status === "canceled") {
    return `${targetLabel} canceled`;
  }

  return "Billing portal closed";
}

function getBillingDescription(status: "success" | "canceled" | "portal", scope: "individual" | "team") {
  const targetLabel =
    scope === "team" ? "the selected team workspace" : "your personal workspace";

  if (status === "success") {
    return `Stripe has returned to Prompt Dock after a completed checkout. The extension will refresh billing for ${targetLabel} when you return to it.`;
  }

  if (status === "canceled") {
    return scope === "team"
      ? "No billing changes were applied. The selected team workspace will stay locked until a team plan becomes active."
      : "No billing changes were applied. Prompt Dock remains available in local mode until an individual plan becomes active.";
  }

  return "Any changes made in the Stripe billing portal can now be reloaded in the Prompt Dock extension.";
}
