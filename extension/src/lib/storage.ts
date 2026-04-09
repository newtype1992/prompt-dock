import type { LocalPromptLibrary, PromptDraft, PromptFolder, PromptRecord } from "./types";

const LOCAL_LIBRARY_KEY = "promptDock.localLibrary.v1";
const CLOUD_LIBRARY_CACHE_KEY = "promptDock.cloudLibraryCache.v1";
const CLOUD_SYNC_METADATA_KEY = "promptDock.cloudSyncMetadata.v1";
const ACTIVE_WORKSPACE_KEY = "promptDock.activeWorkspace.v1";

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

type CloudLibraryCacheRecord = {
  library: LocalPromptLibrary;
  cachedAt: string;
};

type CloudSyncMetadataRecord = {
  importedLocalAt: string | null;
  lastSyncedAt: string | null;
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

export async function getCloudLibraryCache(userId: string): Promise<LocalPromptLibrary | null> {
  const stored = await chrome.storage.local.get(CLOUD_LIBRARY_CACHE_KEY);
  const cacheMap = stored[CLOUD_LIBRARY_CACHE_KEY] as Record<string, CloudLibraryCacheRecord> | undefined;
  const cachedLibrary = cacheMap?.[userId];

  if (!cachedLibrary) {
    return null;
  }

  return structuredClone(cachedLibrary.library);
}

export async function saveCloudLibraryCache(userId: string, library: LocalPromptLibrary) {
  const stored = await chrome.storage.local.get(CLOUD_LIBRARY_CACHE_KEY);
  const cacheMap = (stored[CLOUD_LIBRARY_CACHE_KEY] as Record<string, CloudLibraryCacheRecord> | undefined) ?? {};

  cacheMap[userId] = {
    library,
    cachedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({
    [CLOUD_LIBRARY_CACHE_KEY]: cacheMap,
  });
}

export async function getCloudSyncMetadata(userId: string): Promise<CloudSyncMetadataRecord> {
  const stored = await chrome.storage.local.get(CLOUD_SYNC_METADATA_KEY);
  const metadataMap = stored[CLOUD_SYNC_METADATA_KEY] as Record<string, CloudSyncMetadataRecord> | undefined;

  return (
    metadataMap?.[userId] ?? {
      importedLocalAt: null,
      lastSyncedAt: null,
    }
  );
}

export async function saveCloudSyncMetadata(userId: string, metadata: CloudSyncMetadataRecord) {
  const stored = await chrome.storage.local.get(CLOUD_SYNC_METADATA_KEY);
  const metadataMap = (stored[CLOUD_SYNC_METADATA_KEY] as Record<string, CloudSyncMetadataRecord> | undefined) ?? {};

  metadataMap[userId] = metadata;

  await chrome.storage.local.set({
    [CLOUD_SYNC_METADATA_KEY]: metadataMap,
  });
}

export async function getActiveWorkspacePreference(userId: string) {
  const stored = await chrome.storage.local.get(ACTIVE_WORKSPACE_KEY);
  const workspaceMap = stored[ACTIVE_WORKSPACE_KEY] as Record<string, string | null> | undefined;
  return workspaceMap?.[userId] ?? null;
}

export async function saveActiveWorkspacePreference(userId: string, workspaceId: string | null) {
  const stored = await chrome.storage.local.get(ACTIVE_WORKSPACE_KEY);
  const workspaceMap = (stored[ACTIVE_WORKSPACE_KEY] as Record<string, string | null> | undefined) ?? {};

  if (workspaceId) {
    workspaceMap[userId] = workspaceId;
  } else {
    delete workspaceMap[userId];
  }

  await chrome.storage.local.set({
    [ACTIVE_WORKSPACE_KEY]: workspaceMap,
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
