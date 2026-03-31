import { PLAN_KEYS, PRODUCT_NAME, SUPPORTED_SITES } from "@/lib/product/config";

const capabilities = [
  "Local personal library",
  "Folders, tags, and search",
  "Direct injection with clipboard fallback",
  "Paid sync and team upgrades",
] as const;

export default function App() {
  return (
    <div className="flex min-h-[560px] flex-col gap-5 p-5 text-slate-900">
      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_48px_-34px_rgba(28,42,66,0.45)]">
        <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
          Scaffolded popup
        </div>
        <div className="mt-4 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
          <p className="text-sm leading-6 text-slate-600">
            The extension scaffold is in place. Next implementation steps are local prompt CRUD, sync wiring, and site
            adapters that move beyond placeholder detection.
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        <Panel title="Plans" items={PLAN_KEYS} />
        <Panel title="Supported sites" items={SUPPORTED_SITES} />
        <Panel title="Core capabilities" items={capabilities} />
      </section>

      <section className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-4 text-slate-100 shadow-[0_18px_42px_-30px_rgba(20,29,52,0.55)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Next build slice</p>
        <ol className="mt-3 space-y-2 text-sm text-slate-200">
          <li>1. Replace the static popup with local prompt storage and folder creation.</li>
          <li>2. Wire a real injection command from popup to active content script.</li>
          <li>3. Add paid auth, sync, and upgrade states.</li>
        </ol>
      </section>
    </div>
  );
}

function Panel({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

