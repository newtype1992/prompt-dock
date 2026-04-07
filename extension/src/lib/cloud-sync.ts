import type { SupabaseClient, User } from "@supabase/supabase-js";
import { mapRemoteLibraryRowsToLocalLibrary, shouldImportLocalLibrary, type RemoteFolderRow, type RemotePromptRow } from "./cloud-mappers";
import {
  createFolder,
  createPromptRecord,
  duplicatePromptRecord,
  getCloudLibraryCache,
  getCloudSyncMetadata,
  getLocalLibrary,
  normalizeTags,
  saveCloudLibraryCache,
  saveCloudSyncMetadata,
  saveLocalLibrary,
  updatePromptRecord,
} from "./storage";
import { getExtensionSupabaseClient, getSupabaseRuntimeConfig } from "./supabase";
import type { LocalPromptLibrary, PromptDraft, PromptRecord } from "./types";

type AccountSummary = {
  email: string;
  userId: string;
};

export type PopupLibraryState = {
  account: AccountSummary | null;
  cloudConfigured: boolean;
  lastSyncedAt: string | null;
  library: LocalPromptLibrary;
  mode: "local" | "cloud";
  syncNotice: string | null;
};

export type AuthActionResult = {
  message: string;
  ok: boolean;
  state?: PopupLibraryState;
};

export type SavePromptResult = {
  promptId: string | null;
  state: PopupLibraryState;
};

export type DuplicatePromptResult = {
  promptId: string | null;
  state: PopupLibraryState;
};

type CloudContext = {
  client: SupabaseClient;
  summary: AccountSummary;
  user: User;
};

export async function loadPopupLibraryState(): Promise<PopupLibraryState> {
  const runtimeConfig = getSupabaseRuntimeConfig();
  const localLibrary = await getLocalLibrary();

  if (!runtimeConfig.configured) {
    return {
      account: null,
      cloudConfigured: false,
      lastSyncedAt: null,
      library: localLibrary,
      mode: "local",
      syncNotice: null,
    };
  }

  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    return {
      account: null,
      cloudConfigured: true,
      lastSyncedAt: null,
      library: localLibrary,
      mode: "local",
      syncNotice: null,
    };
  }

  const cachedLibrary = await getCloudLibraryCache(cloudContext.user.id);
  const syncMetadata = await getCloudSyncMetadata(cloudContext.user.id);

  try {
    let remoteLibrary = await loadPersonalCloudLibrary(cloudContext.client, cloudContext.user.id);
    let importedLocalAt = syncMetadata.importedLocalAt;

    if (!importedLocalAt && shouldImportLocalLibrary(localLibrary, remoteLibrary)) {
      await importLocalLibraryToCloud(cloudContext.client, cloudContext.user, localLibrary);
      remoteLibrary = await loadPersonalCloudLibrary(cloudContext.client, cloudContext.user.id);
      importedLocalAt = new Date().toISOString();
    }

    const lastSyncedAt = new Date().toISOString();

    await saveCloudLibraryCache(cloudContext.user.id, remoteLibrary);
    await saveCloudSyncMetadata(cloudContext.user.id, {
      importedLocalAt,
      lastSyncedAt,
    });

    return {
      account: cloudContext.summary,
      cloudConfigured: true,
      lastSyncedAt,
      library: remoteLibrary,
      mode: "cloud",
      syncNotice: importedLocalAt && !syncMetadata.importedLocalAt ? "Imported your local library into cloud sync." : null,
    };
  } catch {
    if (cachedLibrary) {
      return {
        account: cloudContext.summary,
        cloudConfigured: true,
        lastSyncedAt: syncMetadata.lastSyncedAt,
        library: cachedLibrary,
        mode: "cloud",
        syncNotice: "Using the cached cloud library because the latest refresh failed.",
      };
    }

    return {
      account: cloudContext.summary,
      cloudConfigured: true,
      lastSyncedAt: syncMetadata.lastSyncedAt,
      library: localLibrary,
      mode: "local",
      syncNotice: "Cloud sync is configured, but the cloud library could not be loaded. Using local storage for now.",
    };
  }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  const client = getExtensionSupabaseClient();

  if (!client) {
    return {
      ok: false,
      message: "Cloud sync is unavailable until Supabase public env vars are configured.",
    };
  }

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  const state = await loadPopupLibraryState();

  return {
    ok: true,
    message: `Signed in as ${email}.`,
    state,
  };
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthActionResult> {
  const client = getExtensionSupabaseClient();

  if (!client) {
    return {
      ok: false,
      message: "Cloud sync is unavailable until Supabase public env vars are configured.",
    };
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  if (!data.session) {
    return {
      ok: true,
      message: "Account created. Complete email confirmation, then sign in from the extension.",
    };
  }

  const state = await loadPopupLibraryState();

  return {
    ok: true,
    message: `Account created for ${email}.`,
    state,
  };
}

export async function signOutFromCloud() {
  const client = getExtensionSupabaseClient();

  if (client) {
    await client.auth.signOut();
  }

  return loadPopupLibraryState();
}

export async function refreshCloudLibrary() {
  return loadPopupLibraryState();
}

export async function createFolderForCurrentMode(name: string, currentLibrary: LocalPromptLibrary) {
  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    const nextFolder = createFolder(name);
    const nextLibrary = {
      ...currentLibrary,
      folders: [...currentLibrary.folders, nextFolder].sort((left, right) => left.name.localeCompare(right.name)),
    };

    await saveLocalLibrary(nextLibrary);

    return {
      state: createLocalPopupState(nextLibrary),
    };
  }

  const personalLibrary = await getPersonalLibraryRecord(cloudContext.client, cloudContext.user.id);

  const { error } = await cloudContext.client.from("folders").insert({
    library_id: personalLibrary.id,
    name,
    position: currentLibrary.folders.length,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    state: await loadPopupLibraryState(),
  };
}

export async function savePromptForCurrentMode({
  currentLibrary,
  draft,
  editingPromptId,
}: {
  currentLibrary: LocalPromptLibrary;
  draft: PromptDraft;
  editingPromptId: string | null;
}): Promise<SavePromptResult> {
  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    if (editingPromptId) {
      const existingPrompt = currentLibrary.prompts.find((prompt) => prompt.id === editingPromptId);

      if (!existingPrompt) {
        throw new Error("The selected prompt could not be found.");
      }

      const updatedPrompt = updatePromptRecord(existingPrompt, draft);
      const nextLibrary = {
        ...currentLibrary,
        prompts: currentLibrary.prompts.map((prompt) => (prompt.id === existingPrompt.id ? updatedPrompt : prompt)),
      };

      await saveLocalLibrary(nextLibrary);

      return {
        promptId: updatedPrompt.id,
        state: createLocalPopupState(nextLibrary),
      };
    }

    const nextPrompt = createPromptRecord(draft);
    const nextLibrary = {
      ...currentLibrary,
      prompts: [nextPrompt, ...currentLibrary.prompts],
    };

    await saveLocalLibrary(nextLibrary);

    return {
      promptId: nextPrompt.id,
      state: createLocalPopupState(nextLibrary),
    };
  }

  const personalLibrary = await getPersonalLibraryRecord(cloudContext.client, cloudContext.user.id);

  if (editingPromptId) {
    const { error } = await cloudContext.client
      .from("prompts")
      .update({
        body: draft.body.trim(),
        description: draft.description.trim(),
        folder_id: draft.folderId,
        tags: normalizeTags(draft.tagsInput),
        title: draft.title.trim(),
      })
      .eq("id", editingPromptId)
      .eq("library_id", personalLibrary.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      promptId: editingPromptId,
      state: await loadPopupLibraryState(),
    };
  }

  const { data, error } = await cloudContext.client
    .from("prompts")
    .insert({
      body: draft.body.trim(),
      created_by_user_id: cloudContext.user.id,
      description: draft.description.trim(),
      folder_id: draft.folderId,
      library_id: personalLibrary.id,
      position: currentLibrary.prompts.length,
      tags: normalizeTags(draft.tagsInput),
      title: draft.title.trim(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    promptId: data.id,
    state: await loadPopupLibraryState(),
  };
}

export async function deletePromptForCurrentMode(promptId: string, currentLibrary: LocalPromptLibrary) {
  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    const nextLibrary = {
      ...currentLibrary,
      prompts: currentLibrary.prompts.filter((prompt) => prompt.id !== promptId),
    };

    await saveLocalLibrary(nextLibrary);

    return {
      ...createLocalPopupState(nextLibrary),
    };
  }

  const { error } = await cloudContext.client.from("prompts").delete().eq("id", promptId);

  if (error) {
    throw new Error(error.message);
  }

  return loadPopupLibraryState();
}

export async function duplicatePromptForCurrentMode(prompt: PromptRecord, currentLibrary: LocalPromptLibrary): Promise<DuplicatePromptResult> {
  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    const nextPrompt = duplicatePromptRecord(prompt);
    const nextLibrary = {
      ...currentLibrary,
      prompts: [nextPrompt, ...currentLibrary.prompts],
    };

    await saveLocalLibrary(nextLibrary);

    return {
      promptId: nextPrompt.id,
      state: createLocalPopupState(nextLibrary),
    };
  }

  const personalLibrary = await getPersonalLibraryRecord(cloudContext.client, cloudContext.user.id);
  const nextPrompt = duplicatePromptRecord(prompt);
  const { data, error } = await cloudContext.client
    .from("prompts")
    .insert({
      body: nextPrompt.body,
      created_by_user_id: cloudContext.user.id,
      description: nextPrompt.description,
      folder_id: nextPrompt.folderId,
      library_id: personalLibrary.id,
      position: currentLibrary.prompts.length,
      tags: nextPrompt.tags,
      title: nextPrompt.title,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    promptId: data.id,
    state: await loadPopupLibraryState(),
  };
}

async function getCloudContext(): Promise<CloudContext | null> {
  const client = getExtensionSupabaseClient();

  if (!client) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user) {
    return null;
  }

  return {
    client,
    summary: summarizeUser(session.user),
    user: session.user,
  };
}

async function getPersonalLibraryRecord(client: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await client
      .from("libraries")
      .select("id")
      .eq("scope", "personal")
      .eq("owner_user_id", userId)
      .limit(1)
      .single();

    if (!error) {
      return data;
    }

    if (attempt === 2) {
      throw new Error(error.message);
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 200 * (attempt + 1));
    });
  }

  throw new Error("The personal library could not be loaded.");
}

async function loadPersonalCloudLibrary(client: SupabaseClient, userId: string): Promise<LocalPromptLibrary> {
  const personalLibrary = await getPersonalLibraryRecord(client, userId);
  const [foldersResult, promptsResult] = await Promise.all([
    client.from("folders").select("id, name, position, created_at").eq("library_id", personalLibrary.id).order("position"),
    client
      .from("prompts")
      .select("id, title, description, body, tags, folder_id, created_at, updated_at")
      .eq("library_id", personalLibrary.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (foldersResult.error) {
    throw new Error(foldersResult.error.message);
  }

  if (promptsResult.error) {
    throw new Error(promptsResult.error.message);
  }

  return mapRemoteLibraryRowsToLocalLibrary(
    (foldersResult.data ?? []) as RemoteFolderRow[],
    (promptsResult.data ?? []) as RemotePromptRow[]
  );
}

async function importLocalLibraryToCloud(client: SupabaseClient, user: User, localLibrary: LocalPromptLibrary) {
  const personalLibrary = await getPersonalLibraryRecord(client, user.id);
  const folderIdMap = new Map<string, string | null>();

  for (const [index, folder] of localLibrary.folders.entries()) {
    const { data, error } = await client
      .from("folders")
      .insert({
        library_id: personalLibrary.id,
        name: folder.name,
        position: index,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    folderIdMap.set(folder.id, data.id);
  }

  for (const [index, prompt] of localLibrary.prompts.entries()) {
    const { error } = await client.from("prompts").insert({
      body: prompt.body,
      created_by_user_id: user.id,
      description: prompt.description,
      folder_id: prompt.folderId ? folderIdMap.get(prompt.folderId) ?? null : null,
      library_id: personalLibrary.id,
      position: index,
      tags: prompt.tags,
      title: prompt.title,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

function summarizeUser(user: User): AccountSummary {
  return {
    email: user.email ?? "Signed-in user",
    userId: user.id,
  };
}

function createLocalPopupState(library: LocalPromptLibrary): PopupLibraryState {
  return {
    account: null,
    cloudConfigured: getSupabaseRuntimeConfig().configured,
    lastSyncedAt: null,
    library,
    mode: "local",
    syncNotice: null,
  };
}
