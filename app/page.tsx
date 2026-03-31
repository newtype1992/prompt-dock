import { PLAN_KEYS, PRODUCT_NAME, SUPPORTED_SITES, TEAM_ROLES } from "@/lib/product/config";

const supportSurfaces = [
  "auth handoff",
  "billing routes",
  "invite acceptance",
  "health checks",
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_80px_-40px_rgba(36,44,74,0.35)] backdrop-blur md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Extension-first scaffold
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {PRODUCT_NAME} is now scaffolded as an extension-first product with a minimal support app.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                The extension remains the main experience. This Next.js surface exists only for the hosted pieces that
                should not live in the browser bundle: secure team writes, auth support, billing, invites, and
                operational endpoints.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {PLAN_KEYS.map((plan) => (
                <span
                  key={plan}
                  className="rounded-full border border-border bg-background/70 px-3 py-1 text-muted-foreground"
                >
                  {plan}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background/80 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current support</p>
            <div className="mt-4 grid gap-3">
              {supportSurfaces.map((surface) => (
                <div
                  key={surface}
                  className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-card-foreground"
                >
                  {surface}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          title="Supported AI Sites"
          description="Initial site adapters are scaffolded for the four supported AI surfaces."
          items={SUPPORTED_SITES}
        />
        <InfoCard
          title="Team Roles"
          description="Role names are normalized across docs, product constants, and the first migration."
          items={TEAM_ROLES}
        />
        <InfoCard
          title="Data Domains"
          description="The first migration covers profiles, teams, memberships, invites, libraries, folders, prompts, and subscriptions."
          items={["profiles", "teams", "libraries", "prompts"]}
        />
        <InfoCard
          title="Local Workflow"
          description="The repo uses the same support stack pattern as Swift Slots, with a separate extension build."
          items={["next dev", "supabase db push", "vite build"]}
        />
      </section>
    </main>
  );
}

function InfoCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: readonly string[];
}) {
  return (
    <article className="rounded-3xl border border-border/70 bg-card/85 p-6 shadow-[0_20px_50px_-38px_rgba(32,41,69,0.45)]">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-border bg-background/80 px-3 py-1 text-sm text-foreground/80"
          >
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

