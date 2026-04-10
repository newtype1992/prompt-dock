import type { PromptRecord } from "../lib/types";
import { createPromptDragPayload, PROMPT_DOCK_DRAG_MIME } from "../lib/drag";

export type PopupNotice = {
  tone: "success" | "info" | "error";
  message: string;
};

export function NoticeBanner({ notice }: { notice: PopupNotice }) {
  const toneClass =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return <div className={`rounded-[22px] border px-4 py-3 text-sm font-medium ${toneClass}`}>{notice.message}</div>;
}

export function PageNavButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border px-3 py-3 text-left transition ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`mt-1 text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{description}</div>
    </button>
  );
}

export function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

export function FolderChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

export function PromptCard({
  actionsDisabled,
  folderName,
  isInjecting,
  isSelected,
  prompt,
  onDelete,
  onDuplicate,
  onEdit,
  onInject,
}: {
  actionsDisabled?: boolean;
  folderName: string;
  isInjecting: boolean;
  isSelected: boolean;
  prompt: PromptRecord;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onInject: () => void;
}) {
  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      PROMPT_DOCK_DRAG_MIME,
      createPromptDragPayload({
        promptText: prompt.body,
        title: prompt.title,
      })
    );
    event.dataTransfer.setData("text/plain", prompt.body);
  }

  return (
    <article
      className={`rounded-[24px] border p-4 transition ${
        isSelected ? "border-cyan-300 bg-cyan-50/60" : "border-slate-200 bg-slate-50/85 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{prompt.title}</h3>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{folderName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            draggable
            onDragStart={handleDragStart}
            title="Drag this prompt into the active AI composer"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 cursor-grab active:cursor-grabbing"
          >
            Drag to page
          </div>
          <button
            type="button"
            onClick={onInject}
            disabled={isInjecting}
            className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isInjecting ? "Using..." : "Use"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {prompt.description || "No description yet. This prompt will still inject correctly."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {prompt.tags.length ? (
          prompt.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            No tags
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Open
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={actionsDisabled}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={actionsDisabled}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Drag this prompt onto a supported AI composer to drop it into the text field, or use one-click insert.
      </p>
    </article>
  );
}
