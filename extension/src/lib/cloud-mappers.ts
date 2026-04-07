import type { LocalPromptLibrary } from "./types";

export type RemoteFolderRow = {
  created_at: string;
  id: string;
  name: string;
  position: number;
};

export type RemotePromptRow = {
  body: string;
  created_at: string;
  description: string;
  folder_id: string | null;
  id: string;
  tags: string[] | null;
  title: string;
  updated_at: string;
};

export function mapRemoteLibraryRowsToLocalLibrary(
  folders: RemoteFolderRow[],
  prompts: RemotePromptRow[]
): LocalPromptLibrary {
  return {
    version: 1,
    folders: [...folders]
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        createdAt: folder.created_at,
      })),
    prompts: [...prompts].map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      body: prompt.body,
      tags: normalizeRemoteTags(prompt.tags),
      folderId: prompt.folder_id,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
    })),
  };
}

export function shouldImportLocalLibrary(localLibrary: LocalPromptLibrary, remoteLibrary: LocalPromptLibrary) {
  return hasLibraryContent(localLibrary) && !hasLibraryContent(remoteLibrary);
}

export function hasLibraryContent(library: LocalPromptLibrary) {
  return library.folders.length > 0 || library.prompts.length > 0;
}

function normalizeRemoteTags(tags: string[] | null) {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}
