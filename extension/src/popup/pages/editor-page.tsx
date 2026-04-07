import type { LocalPromptLibrary, PromptDraft, PromptRecord } from "../../lib/types";

export function EditorPage({
  draft,
  editingPromptId,
  isSaving,
  library,
  libraryMode,
  selectedPrompt,
  onBeginCreatePrompt,
  onChangeDraft,
  onDeletePrompt,
  onDuplicatePrompt,
  onGoToAccount,
  onGoToLibrary,
  onSavePrompt,
}: {
  draft: PromptDraft;
  editingPromptId: string | null;
  isSaving: boolean;
  library: LocalPromptLibrary;
  libraryMode: "local" | "cloud";
  selectedPrompt: PromptRecord | null;
  onBeginCreatePrompt: () => void;
  onChangeDraft: (nextDraft: PromptDraft) => void;
  onDeletePrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  onGoToAccount: () => void;
  onGoToLibrary: () => void;
  onSavePrompt: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Editor</p>
            <h2 className="mt-1 text-lg font-semibold">
              {editingPromptId
                ? libraryMode === "cloud"
                  ? "Edit synced prompt"
                  : "Edit local prompt"
                : libraryMode === "cloud"
                  ? "Create synced prompt"
                  : "Create local prompt"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoToLibrary}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Back to library
            </button>
            <button
              type="button"
              onClick={onBeginCreatePrompt}
              className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
            >
              New draft
            </button>
          </div>
        </div>

        {selectedPrompt ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDuplicatePrompt(selectedPrompt.id)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => onDeletePrompt(selectedPrompt.id)}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onGoToAccount}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Account
            </button>
          </div>
        ) : null}
      </section>

      <form
        className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]"
        onSubmit={onSavePrompt}
      >
        <div className="grid gap-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Title</span>
            <input
              value={draft.title}
              onChange={(event) => onChangeDraft({ ...draft, title: event.target.value })}
              placeholder="Prompt title"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Description</span>
            <input
              value={draft.description}
              onChange={(event) => onChangeDraft({ ...draft, description: event.target.value })}
              placeholder="What is this prompt for?"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Folder</span>
              <select
                value={draft.folderId ?? ""}
                onChange={(event) => onChangeDraft({ ...draft, folderId: event.target.value || null })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              >
                <option value="">No folder</option>
                {library.folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Tags</span>
              <input
                value={draft.tagsInput}
                onChange={(event) => onChangeDraft({ ...draft, tagsInput: event.target.value })}
                placeholder="research, writing, outreach"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Prompt body</span>
            <textarea
              value={draft.body}
              onChange={(event) => onChangeDraft({ ...draft, body: event.target.value })}
              placeholder="Write the reusable prompt text here."
              rows={12}
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">
              {libraryMode === "cloud"
                ? "This prompt syncs to your personal cloud library and refreshes the local cache."
                : "This prompt stays in local extension storage until you sign in for cloud sync."}
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : editingPromptId ? "Save changes" : "Create prompt"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
