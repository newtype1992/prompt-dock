import type { LocalPromptLibrary, PromptDraft, PromptFolder, PromptRecord } from "./types";

const LOCAL_LIBRARY_KEY = "promptDock.localLibrary.v1";

const DEFAULT_LIBRARY: LocalPromptLibrary = {
  version: 1,
  folders: [
    {
      id: "folder-research",
      name: "Research",
      createdAt: "2026-03-31T10:00:00.000Z",
    },
    {
      id: "folder-writing",
      name: "Writing",
      createdAt: "2026-03-31T10:01:00.000Z",
    },
  ],
  prompts: [
    {
      id: "prompt-research-brief",
      title: "Research Brief",
      description: "Turn a rough topic into a structured brief with open questions and sources to verify.",
      body:
        "You are my research analyst. Break down this topic into: 1) key questions, 2) what is already known, 3) assumptions to verify, 4) risks or blind spots, and 5) a compact next-step plan. Keep the response structured and practical.",
      tags: ["research", "analysis"],
      folderId: "folder-research",
      createdAt: "2026-03-31T10:05:00.000Z",
      updatedAt: "2026-03-31T10:05:00.000Z",
    },
    {
      id: "prompt-tighten-copy",
      title: "Tighten Draft Copy",
      description: "Rewrite draft text to be sharper without changing intent.",
      body:
        "Rewrite the text below so it is clearer, tighter, and more persuasive. Preserve the original meaning, remove repetition, and keep the tone direct. Then give me a second version that is more concise.",
      tags: ["writing", "editing"],
      folderId: "folder-writing",
      createdAt: "2026-03-31T10:06:00.000Z",
      updatedAt: "2026-03-31T10:06:00.000Z",
    },
    {
      id: "prompt-meeting-follow-up",
      title: "Meeting Follow-Up",
      description: "Summarize a meeting and convert it into clear action items.",
      body:
        "Summarize the discussion into decisions, unresolved questions, owners, and deadlines. Use a concise format that can be pasted directly into a follow-up email.",
      tags: ["meetings", "ops"],
      folderId: null,
      createdAt: "2026-03-31T10:07:00.000Z",
      updatedAt: "2026-03-31T10:07:00.000Z",
    },
  ],
};

export function createEmptyPromptDraft(folderId: string | null = null): PromptDraft {
  return {
    title: "",
    description: "",
    body: "",
    tagsInput: "",
    folderId,
  };
}

export function draftFromPrompt(prompt: PromptRecord): PromptDraft {
  return {
    title: prompt.title,
    description: prompt.description,
    body: prompt.body,
    tagsInput: prompt.tags.join(", "),
    folderId: prompt.folderId,
  };
}

export async function getLocalLibrary(): Promise<LocalPromptLibrary> {
  const stored = await chrome.storage.local.get(LOCAL_LIBRARY_KEY);
  const existingLibrary = stored[LOCAL_LIBRARY_KEY] as LocalPromptLibrary | undefined;

  if (existingLibrary) {
    return existingLibrary;
  }

  await saveLocalLibrary(DEFAULT_LIBRARY);
  return structuredClone(DEFAULT_LIBRARY);
}

export async function saveLocalLibrary(library: LocalPromptLibrary) {
  await chrome.storage.local.set({
    [LOCAL_LIBRARY_KEY]: library,
  });
}

export function createFolder(name: string): PromptFolder {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  };
}

export function createPromptRecord(draft: PromptDraft): PromptRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    body: draft.body.trim(),
    tags: normalizeTags(draft.tagsInput),
    folderId: draft.folderId,
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePromptRecord(prompt: PromptRecord, draft: PromptDraft): PromptRecord {
  return {
    ...prompt,
    title: draft.title.trim(),
    description: draft.description.trim(),
    body: draft.body.trim(),
    tags: normalizeTags(draft.tagsInput),
    folderId: draft.folderId,
    updatedAt: new Date().toISOString(),
  };
}

export function duplicatePromptRecord(prompt: PromptRecord): PromptRecord {
  const now = new Date().toISOString();

  return {
    ...prompt,
    id: crypto.randomUUID(),
    title: `${prompt.title} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.toLowerCase())
    )
  );
}

