import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "@/lib/product/config";
import { getActiveSiteSummary, injectPromptFromPopup } from "../lib/injection";
import {
  createEmptyPromptDraft,
  createFolder,
  createPromptRecord,
  draftFromPrompt,
  duplicatePromptRecord,
  getLocalLibrary,
  saveLocalLibrary,
  updatePromptRecord,
} from "../lib/storage";
import type { LocalPromptLibrary, PromptDraft, PromptRecord } from "../lib/types";

type PopupNotice = {
  tone: "success" | "info" | "error";
  message: string;
};

export default function App() {
  const [library, setLibrary] = useState<LocalPromptLibrary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft>(createEmptyPromptDraft());
  const [newFolderName, setNewFolderName] = useState("");
  const [siteLabel, setSiteLabel] = useState("Checking active tab...");
  const [siteSupported, setSiteSupported] = useState(false);
  const [notice, setNotice] = useState<PopupNotice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [injectingPromptId, setInjectingPromptId] = useState<string | null>(null);

  useEffect(() => {
    void loadPopupData();
  }, []);

  async function loadPopupData() {
    const [nextLibrary, nextSiteSummary] = await Promise.all([getLocalLibrary(), getActiveSiteSummary()]);

    setLibrary(nextLibrary);
    setSiteLabel(nextSiteSummary.label);
    setSiteSupported(nextSiteSummary.supported);

    const nextPrompt = sortPromptRecords(nextLibrary.prompts)[0];

    if (nextPrompt) {
      setEditingPromptId(nextPrompt.id);
      setDraft(draftFromPrompt(nextPrompt));
    } else {
      setEditingPromptId(null);
      setDraft(createEmptyPromptDraft());
    }

    setIsLoading(false);
  }

  async function persistLibrary(nextLibrary: LocalPromptLibrary) {
    setLibrary(nextLibrary);
    await saveLocalLibrary(nextLibrary);
  }

  function selectPrompt(prompt: PromptRecord) {
    setEditingPromptId(prompt.id);
    setDraft(draftFromPrompt(prompt));
  }

  function beginCreatePrompt() {
    setEditingPromptId(null);
    setDraft(createEmptyPromptDraft(activeFolderId === "all" ? null : activeFolderId));
  }

  async function handleSavePrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!library) {
      return;
    }

    if (!draft.title.trim() || !draft.body.trim()) {
      setNotice({
        tone: "error",
        message: "Every prompt needs a title and body.",
      });
      return;
    }

    setIsSaving(true);

    if (editingPromptId) {
      const existingPrompt = library.prompts.find((prompt) => prompt.id === editingPromptId);

      if (!existingPrompt) {
        setNotice({
          tone: "error",
          message: "The selected prompt could not be found.",
        });
        setIsSaving(false);
        return;
      }

      const updatedPrompt = updatePromptRecord(existingPrompt, draft);
      const nextLibrary = {
        ...library,
        prompts: library.prompts.map((prompt) => (prompt.id === existingPrompt.id ? updatedPrompt : prompt)),
      };

      await persistLibrary(nextLibrary);
      setDraft(draftFromPrompt(updatedPrompt));
      setNotice({
        tone: "success",
        message: "Prompt updated locally.",
      });
      setIsSaving(false);
      return;
    }

    const nextPrompt = createPromptRecord(draft);
    const nextLibrary = {
      ...library,
      prompts: [nextPrompt, ...library.prompts],
    };

    await persistLibrary(nextLibrary);
    setEditingPromptId(nextPrompt.id);
    setDraft(draftFromPrompt(nextPrompt));
    setNotice({
      tone: "success",
      message: "Prompt created locally.",
    });
    setIsSaving(false);
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!library) {
      return;
    }

    const folderName = newFolderName.trim();

    if (!folderName) {
      setNotice({
        tone: "error",
        message: "Folder names cannot be empty.",
      });
      return;
    }

    const duplicateFolder = library.folders.find(
      (folder) => folder.name.toLowerCase() === folderName.toLowerCase()
    );

    if (duplicateFolder) {
      setActiveFolderId(duplicateFolder.id);
      setNewFolderName("");
      setDraft((currentDraft) => ({
        ...currentDraft,
        folderId: duplicateFolder.id,
      }));
      setNotice({
        tone: "info",
        message: "That folder already exists, so it has been selected instead.",
      });
      return;
    }

    const nextFolder = createFolder(folderName);
    const nextLibrary = {
      ...library,
      folders: [...library.folders, nextFolder].sort((left, right) => left.name.localeCompare(right.name)),
    };

    await persistLibrary(nextLibrary);
    setNewFolderName("");
    setActiveFolderId(nextFolder.id);
    setDraft((currentDraft) => ({
      ...currentDraft,
      folderId: nextFolder.id,
    }));
    setNotice({
      tone: "success",
      message: `Folder "${nextFolder.name}" created.`,
    });
  }

  async function handleDeletePrompt(promptId: string) {
    if (!library) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    if (!window.confirm(`Delete "${prompt.title}" from local storage?`)) {
      return;
    }

    const nextPrompts = library.prompts.filter((item) => item.id !== promptId);
    const nextLibrary = {
      ...library,
      prompts: nextPrompts,
    };

    await persistLibrary(nextLibrary);

    const nextSelectedPrompt = sortPromptRecords(nextPrompts)[0];

    if (nextSelectedPrompt) {
      setEditingPromptId(nextSelectedPrompt.id);
      setDraft(draftFromPrompt(nextSelectedPrompt));
    } else {
      setEditingPromptId(null);
      setDraft(createEmptyPromptDraft(activeFolderId === "all" ? null : activeFolderId));
    }

    setNotice({
      tone: "success",
      message: "Prompt deleted from local storage.",
    });
  }

  async function handleDuplicatePrompt(promptId: string) {
    if (!library) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    const nextPrompt = duplicatePromptRecord(prompt);
    const nextLibrary = {
      ...library,
      prompts: [nextPrompt, ...library.prompts],
    };

    await persistLibrary(nextLibrary);
    setEditingPromptId(nextPrompt.id);
    setDraft(draftFromPrompt(nextPrompt));
    setNotice({
      tone: "success",
      message: `Duplicated "${prompt.title}".`,
    });
  }

  async function handleInjectPrompt(prompt: PromptRecord) {
    setInjectingPromptId(prompt.id);
    const result = await injectPromptFromPopup(prompt.body);
    setInjectingPromptId(null);
    setNotice({
      tone: result.status === "error" ? "error" : result.status === "clipboard" ? "info" : "success",
      message: result.message,
    });
  }

  if (isLoading || !library) {
    return (
      <div className="flex min-h-[560px] items-center justify-center p-6 text-sm text-slate-600">
        Loading Prompt Dock...
      </div>
    );
  }

  const visiblePrompts = sortPromptRecords(
    library.prompts.filter((prompt) => {
      if (activeFolderId !== "all" && prompt.folderId !== activeFolderId) {
        return false;
      }

      if (!searchTerm.trim()) {
        return true;
      }

      return promptMatchesSearch(prompt, searchTerm);
    })
  );

  return (
    <div className="flex min-h-[640px] flex-col gap-4 p-4 text-slate-900">
      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_48px_-34px_rgba(28,42,66,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
              Free local mode
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Save reusable prompts locally, organize them by folder and tags, and inject them into supported AI
                tools.
              </p>
            </div>
          </div>
          <div
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${
              siteSupported
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {siteLabel}
          </div>
        </div>
      </section>

      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Search prompts</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, body, or tag"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
            />
          </label>

          <form className="space-y-3" onSubmit={handleCreateFolder}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Folders</p>
              <button
                type="button"
                onClick={() => setActiveFolderId("all")}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
              >
                Clear filter
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <FolderChip
                active={activeFolderId === "all"}
                label={`All prompts (${library.prompts.length})`}
                onClick={() => setActiveFolderId("all")}
              />
              {library.folders.map((folder) => (
                <FolderChip
                  key={folder.id}
                  active={activeFolderId === folder.id}
                  label={`${folder.name} (${countPromptsInFolder(library.prompts, folder.id)})`}
                  onClick={() => setActiveFolderId(folder.id)}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
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

      <section className="grid gap-4">
        <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Library</p>
              <h2 className="mt-1 text-lg font-semibold">Saved prompts</h2>
            </div>
            <button
              type="button"
              onClick={beginCreatePrompt}
              className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
            >
              New prompt
            </button>
          </div>

          <div className="mt-4 grid max-h-[280px] gap-3 overflow-y-auto pr-1">
            {visiblePrompts.length ? (
              visiblePrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  folderName={library.folders.find((folder) => folder.id === prompt.folderId)?.name ?? "No folder"}
                  isInjecting={injectingPromptId === prompt.id}
                  isSelected={editingPromptId === prompt.id}
                  prompt={prompt}
                  onDelete={() => void handleDeletePrompt(prompt.id)}
                  onDuplicate={() => void handleDuplicatePrompt(prompt.id)}
                  onEdit={() => selectPrompt(prompt)}
                  onInject={() => void handleInjectPrompt(prompt)}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-600">
                {library.prompts.length
                  ? "No prompts match the current search and folder filters."
                  : "Your local library is empty. Create a prompt to start injecting reusable text into AI tools."}
              </div>
            )}
          </div>
        </div>

        <form
          className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]"
          onSubmit={(event) => void handleSavePrompt(event)}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Editor</p>
              <h2 className="mt-1 text-lg font-semibold">
                {editingPromptId ? "Edit local prompt" : "Create local prompt"}
              </h2>
            </div>
            <button
              type="button"
              onClick={beginCreatePrompt}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-800"
            >
              Reset form
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                placeholder="Prompt title"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Description</span>
              <input
                value={draft.description}
                onChange={(event) =>
                  setDraft((currentDraft) => ({ ...currentDraft, description: event.target.value }))
                }
                placeholder="What is this prompt for?"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Folder</span>
                <select
                  value={draft.folderId ?? ""}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      folderId: event.target.value || null,
                    }))
                  }
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
                  onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, tagsInput: event.target.value }))}
                  placeholder="research, writing, outreach"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Prompt body</span>
              <textarea
                value={draft.body}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
                placeholder="Write the reusable prompt text here."
                rows={7}
                className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                This prompt stays in local extension storage until paid sync is added to your account.
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
      </section>
    </div>
  );
}

function NoticeBanner({ notice }: { notice: PopupNotice }) {
  const toneClass =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return <div className={`rounded-[22px] border px-4 py-3 text-sm font-medium ${toneClass}`}>{notice.message}</div>;
}

function FolderChip({
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

function PromptCard({
  folderName,
  isInjecting,
  isSelected,
  prompt,
  onDelete,
  onDuplicate,
  onEdit,
  onInject,
}: {
  folderName: string;
  isInjecting: boolean;
  isSelected: boolean;
  prompt: PromptRecord;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onInject: () => void;
}) {
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
        <button
          type="button"
          onClick={onInject}
          disabled={isInjecting}
          className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isInjecting ? "Using..." : "Use"}
        </button>
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
          Edit
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function sortPromptRecords(prompts: PromptRecord[]) {
  return [...prompts].sort((left, right) => {
    const timeDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return left.title.localeCompare(right.title);
  });
}

function promptMatchesSearch(prompt: PromptRecord, searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystack = [prompt.title, prompt.description, prompt.body, prompt.tags.join(" ")]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function countPromptsInFolder(prompts: PromptRecord[], folderId: string) {
  return prompts.filter((prompt) => prompt.folderId === folderId).length;
}
