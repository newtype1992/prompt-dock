import { FolderChip, PromptCard } from "../components";
import type { LocalPromptLibrary, PromptRecord } from "../../lib/types";

export function LibraryPage({
  activeFolderId,
  injectingPromptId,
  library,
  libraryMode,
  newFolderName,
  searchTerm,
  selectedPromptId,
  visiblePrompts,
  onBeginCreatePrompt,
  onChangeNewFolderName,
  onChangeSearchTerm,
  onClearFilter,
  onCreateFolder,
  onDeletePrompt,
  onDuplicatePrompt,
  onGoToAccount,
  onInjectPrompt,
  onSelectFolder,
  onSelectPrompt,
}: {
  activeFolderId: string;
  injectingPromptId: string | null;
  library: LocalPromptLibrary;
  libraryMode: "local" | "cloud";
  newFolderName: string;
  searchTerm: string;
  selectedPromptId: string | null;
  visiblePrompts: PromptRecord[];
  onBeginCreatePrompt: () => void;
  onChangeNewFolderName: (value: string) => void;
  onChangeSearchTerm: (value: string) => void;
  onClearFilter: () => void;
  onCreateFolder: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeletePrompt: (promptId: string) => void;
  onDuplicatePrompt: (promptId: string) => void;
  onGoToAccount: () => void;
  onInjectPrompt: (prompt: PromptRecord) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectPrompt: (prompt: PromptRecord) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Library</p>
              <h2 className="mt-1 text-lg font-semibold">
                {libraryMode === "cloud" ? "Synced prompts" : "Saved prompts"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onBeginCreatePrompt}
              className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
            >
              New prompt
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Search prompts</span>
            <input
              value={searchTerm}
              onChange={(event) => onChangeSearchTerm(event.target.value)}
              placeholder="Search by title, description, body, or tag"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
            />
          </label>

          <form className="space-y-3" onSubmit={onCreateFolder}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Folders</p>
              <button
                type="button"
                onClick={onClearFilter}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
              >
                Clear filter
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <FolderChip active={activeFolderId === "all"} label={`All prompts (${library.prompts.length})`} onClick={onClearFilter} />
              {library.folders.map((folder) => (
                <FolderChip
                  key={folder.id}
                  active={activeFolderId === folder.id}
                  label={`${folder.name} (${countPromptsInFolder(library.prompts, folder.id)})`}
                  onClick={() => onSelectFolder(folder.id)}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(event) => onChangeNewFolderName(event.target.value)}
                placeholder="Add a folder"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              />
              <button
                type="submit"
                className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Results</p>
              <h2 className="mt-1 text-lg font-semibold">Prompt library</h2>
            </div>
            <button
              type="button"
              onClick={onGoToAccount}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Account
            </button>
          </div>

          <div className="grid gap-3">
            {visiblePrompts.length ? (
              visiblePrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  folderName={library.folders.find((folder) => folder.id === prompt.folderId)?.name ?? "No folder"}
                  isInjecting={injectingPromptId === prompt.id}
                  isSelected={selectedPromptId === prompt.id}
                  prompt={prompt}
                  onDelete={() => onDeletePrompt(prompt.id)}
                  onDuplicate={() => onDuplicatePrompt(prompt.id)}
                  onEdit={() => onSelectPrompt(prompt)}
                  onInject={() => onInjectPrompt(prompt)}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-600">
                {library.prompts.length
                  ? "No prompts match the current search and folder filters."
                  : libraryMode === "cloud"
                    ? "Your personal cloud library is empty. Create a prompt to start syncing reusable text."
                    : "Your local library is empty. Create a prompt to start injecting reusable text into AI tools."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function countPromptsInFolder(prompts: PromptRecord[], folderId: string) {
  return prompts.filter((prompt) => prompt.folderId === folderId).length;
}
