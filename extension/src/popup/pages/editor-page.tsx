import type { LocalPromptLibrary, PromptDraft, PromptRecord, PromptWorkspace } from "../../lib/types";

export function EditorPage({
  activeWorkspace,
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
  activeWorkspace: PromptWorkspace;
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
  const canManageWorkspace = activeWorkspace.access === "ready" && activeWorkspace.canEdit;

  return (
    <div className="grid gap-4">
      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Editor</p>
            <h2 className="mt-1 text-lg font-semibold">
              {getEditorTitle({
                activeWorkspace,
                editingPromptId,
                libraryMode,
              })}
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
              disabled={!canManageWorkspace}
              className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              New draft
            </button>
          </div>
        </div>

        {selectedPrompt && canManageWorkspace ? (
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

        {!canManageWorkspace ? (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            {getEditorAccessNotice(activeWorkspace)}
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
              disabled={!canManageWorkspace}
              placeholder="Prompt title"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Description</span>
            <input
              value={draft.description}
              onChange={(event) => onChangeDraft({ ...draft, description: event.target.value })}
              disabled={!canManageWorkspace}
              placeholder="What is this prompt for?"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Folder</span>
              <select
                value={draft.folderId ?? ""}
                onChange={(event) => onChangeDraft({ ...draft, folderId: event.target.value || null })}
                disabled={!canManageWorkspace}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                disabled={!canManageWorkspace}
                placeholder="research, writing, outreach"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Prompt body</span>
            <textarea
              value={draft.body}
              onChange={(event) => onChangeDraft({ ...draft, body: event.target.value })}
              disabled={!canManageWorkspace}
              placeholder="Write the reusable prompt text here."
              rows={12}
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">
              {getEditorBodyText(activeWorkspace, libraryMode)}
            </p>
            <button
              type="submit"
              disabled={isSaving || !canManageWorkspace}
              className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!canManageWorkspace ? "Read only" : isSaving ? "Saving..." : editingPromptId ? "Save changes" : "Create prompt"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function getEditorTitle({
  activeWorkspace,
  editingPromptId,
  libraryMode,
}: {
  activeWorkspace: PromptWorkspace;
  editingPromptId: string | null;
  libraryMode: "local" | "cloud";
}) {
  if (activeWorkspace.kind === "team") {
    if (activeWorkspace.access !== "ready") {
      return "Team workspace locked";
    }

    if (!activeWorkspace.canEdit) {
      return editingPromptId ? "View shared prompt" : "Shared prompts are read only";
    }

    return editingPromptId ? "Edit shared prompt" : "Create shared prompt";
  }

  return editingPromptId
    ? libraryMode === "cloud"
      ? "Edit synced prompt"
      : "Edit local prompt"
    : libraryMode === "cloud"
      ? "Create synced prompt"
      : "Create local prompt";
}

function getEditorAccessNotice(activeWorkspace: PromptWorkspace) {
  if (activeWorkspace.kind !== "team") {
    return "This workspace is read only right now.";
  }

  if (activeWorkspace.access !== "ready") {
    return activeWorkspace.accessNotice ?? "This shared library becomes editable after team billing is active.";
  }

  return "Team members can review and use shared prompts here, but only owners and admins can edit them.";
}

function getEditorBodyText(activeWorkspace: PromptWorkspace, libraryMode: "local" | "cloud") {
  if (activeWorkspace.kind === "team") {
    if (activeWorkspace.access !== "ready") {
      return activeWorkspace.accessNotice ?? "This shared library is blocked until team billing is active.";
    }

    return activeWorkspace.canEdit
      ? "This prompt writes into the shared team library."
      : "This shared prompt can be reviewed here and used from the library page.";
  }

  return libraryMode === "cloud"
    ? "This prompt syncs to your personal cloud library and refreshes the local cache."
    : "This prompt stays in local extension storage until you sign in for cloud sync.";
}
