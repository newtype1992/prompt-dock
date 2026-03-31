export default function AuthSupportPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-border/70 bg-card/90 p-8 shadow-[0_24px_60px_-40px_rgba(34,42,70,0.45)]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Auth support</p>
          <h1 className="text-3xl font-semibold tracking-tight">This surface is reserved for extension auth flows.</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Prompt Dock is extension-first. This page exists so the extension can hand off authentication-related flows
            to a hosted support surface without turning the web app into the main product.
          </p>
        </div>
      </section>
    </main>
  );
}

