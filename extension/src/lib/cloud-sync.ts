import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isActiveSubscriptionStatus,
  type SubscriptionPlanKey,
  type SubscriptionStatus,
} from "@/lib/billing/subscriptions";
import {
  mapRemoteLibraryRowsToLocalLibrary,
  shouldImportLocalLibrary,
  type RemoteFolderRow,
  type RemotePromptRow,
} from "./cloud-mappers";
import { acceptTeamInviteRequest, buildInviteUrl, createTeamInviteRequest, extractInviteToken } from "./invites";
import {
  createFolder,
  createPromptRecord,
  duplicatePromptRecord,
  getActiveWorkspacePreference,
  getCloudLibraryCache,
  getCloudSyncMetadata,
  getLocalLibrary,
  normalizeTags,
  saveActiveWorkspacePreference,
  saveCloudLibraryCache,
  saveCloudSyncMetadata,
  saveLocalLibrary,
  updatePromptRecord,
} from "./storage";
import { getExtensionSupabaseClient, getSupabaseRuntimeConfig } from "./supabase";
import type {
  LocalPromptLibrary,
  PromptDraft,
  PromptRecord,
  PromptWorkspace,
  TeamInviteRole,
  TeamInviteSummary,
  TeamRole,
  WorkspaceMode,
} from "./types";
import {
  createEmptyLibrary,
  createTeamSlugCandidate,
  getLocalPersonalWorkspaceId,
  getPersonalWorkspaceId,
  getTeamWorkspaceId,
  resolveWorkspaceSelection,
  sortWorkspaces,
} from "./workspaces";

type AccountSummary = {
  email: string;
  userId: string;
};

export type PersonalBillingSummary = {
  currentPeriodEnd: string | null;
  planKey: SubscriptionPlanKey | null;
  status: SubscriptionStatus | null;
};

export type PopupLibraryState = {
  account: AccountSummary | null;
  activeWorkspace: PromptWorkspace;
  billing: PersonalBillingSummary;
  cloudConfigured: boolean;
  lastSyncedAt: string | null;
  library: LocalPromptLibrary;
  mode: WorkspaceMode;
  syncNotice: string | null;
  teamInvites: TeamInviteSummary[];
  workspaces: PromptWorkspace[];
};

export type AuthActionResult = {
  message: string;
  ok: boolean;
  state?: PopupLibraryState;
};

export type CreateTeamResult = {
  message: string;
  ok: boolean;
  state?: PopupLibraryState;
};

export type TeamInviteActionResult = {
  invite?: TeamInviteSummary;
  message: string;
  ok: boolean;
  state?: PopupLibraryState;
  teamName?: string;
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

type SignedInBillingContext = {
  billing: PersonalBillingSummary;
  cloudContext: CloudContext;
};

type TeamMembershipRecord = {
  role: TeamRole;
  teamId: string;
  teamName: string;
};

type TeamLibraryRecord = {
  createdAt: string;
  id: string;
  name: string;
  teamId: string;
};

type ActiveLibraryState = {
  lastSyncedAt: string | null;
  library: LocalPromptLibrary;
  mode: WorkspaceMode;
  syncNotice: string | null;
};

const TEAM_SHARED_LIBRARY_NAME = "Shared prompts";

export async function loadPopupLibraryState(preferredWorkspaceId?: string | null): Promise<PopupLibraryState> {
  const runtimeConfig = getSupabaseRuntimeConfig();
  const localLibrary = await getLocalLibrary();

  if (!runtimeConfig.configured) {
    return createLocalOnlyPopupState(localLibrary, {
      cloudConfigured: false,
    });
  }

  const signedInBillingContext = await getSignedInBillingContext();

  if (!signedInBillingContext) {
    return createLocalOnlyPopupState(localLibrary, {
      cloudConfigured: true,
    });
  }

  const { billing, cloudContext } = signedInBillingContext;
  const personalWorkspace = createPersonalWorkspace(cloudContext.user.id, billing);
  const teamWorkspaces = await loadTeamWorkspaces(cloudContext.client, cloudContext.user.id);
  const workspaces = sortWorkspaces([personalWorkspace, ...teamWorkspaces]);
  const savedWorkspaceId = await getActiveWorkspacePreference(cloudContext.user.id);
  const activeWorkspaceId = resolveWorkspaceSelection(workspaces, preferredWorkspaceId ?? savedWorkspaceId);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    personalWorkspace;

  await saveActiveWorkspacePreference(cloudContext.user.id, activeWorkspace.id);

  const activeLibraryState = await loadActiveLibraryState({
    activeWorkspace,
    billing,
    cloudContext,
    localLibrary,
  });
  const teamInvites = await loadActiveTeamInvites(cloudContext.client, activeWorkspace);

  return {
    account: cloudContext.summary,
    activeWorkspace,
    billing,
    cloudConfigured: true,
    lastSyncedAt: activeLibraryState.lastSyncedAt,
    library: activeLibraryState.library,
    mode: activeLibraryState.mode,
    syncNotice: activeLibraryState.syncNotice,
    teamInvites,
    workspaces,
  };
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

export async function refreshCloudLibrary(activeWorkspaceId?: string | null) {
  return loadPopupLibraryState(activeWorkspaceId);
}

export async function switchWorkspace(workspaceId: string) {
  return loadPopupLibraryState(workspaceId);
}

export async function createTeamWorkspace(name: string): Promise<CreateTeamResult> {
  const signedInBillingContext = await getSignedInBillingContext();

  if (!signedInBillingContext) {
    return {
      ok: false,
      message: "Sign in before creating a shared team workspace.",
    };
  }

  const teamName = name.trim();

  if (teamName.length < 3) {
    return {
      ok: false,
      message: "Team names need at least 3 characters.",
    };
  }

  const { cloudContext } = signedInBillingContext;
  const slugBase = createTeamSlugCandidate(teamName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${Math.floor(Math.random() * 9000) + 1000}`;
    const { data, error } = await cloudContext.client
      .from("teams")
      .insert({
        created_by_user_id: cloudContext.user.id,
        name: teamName,
        slug,
      })
      .select("id")
      .single<{ id: string }>();

    if (!error && data) {
      await ensureTeamSharedLibrary(cloudContext.client, data.id, cloudContext.user.id);

      return {
        ok: true,
        message: `Created ${teamName}. Team billing needs to be activated before the shared library unlocks.`,
        state: await loadPopupLibraryState(getTeamWorkspaceId(data.id)),
      };
    }

    if (!isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: error?.message ?? "The team workspace could not be created.",
      };
    }
  }

  return {
    ok: false,
    message: "The team workspace could not be created because a unique slug could not be reserved.",
  };
}

export async function createInviteForActiveTeamWorkspace({
  activeWorkspace,
  email,
  role,
}: {
  activeWorkspace: PromptWorkspace;
  email: string;
  role: TeamInviteRole;
}): Promise<TeamInviteActionResult> {
  if (activeWorkspace.kind !== "team" || !activeWorkspace.teamId) {
    return {
      ok: false,
      message: "Switch into a team workspace before creating invites.",
    };
  }

  if (activeWorkspace.role !== "owner" && activeWorkspace.role !== "admin") {
    return {
      ok: false,
      message: "Only team owners and admins can invite teammates.",
    };
  }

  const invite = await createTeamInviteRequest({
    email,
    role,
    teamId: activeWorkspace.teamId,
  });
  const state = await loadPopupLibraryState(activeWorkspace.id);

  return {
    invite,
    message: `Invite created for ${invite.email}.`,
    ok: true,
    state,
    teamName: invite.teamName,
  };
}

export async function acceptInviteFromInput(inviteInput: string): Promise<TeamInviteActionResult> {
  const token = extractInviteToken(inviteInput);
  const result = await acceptTeamInviteRequest(token);
  const state = await loadPopupLibraryState(getTeamWorkspaceId(result.teamId));

  return {
    message: `Joined ${result.teamName}.`,
    ok: true,
    state,
    teamName: result.teamName,
  };
}

export async function createFolderForCurrentMode(
  name: string,
  currentLibrary: LocalPromptLibrary,
  activeWorkspace: PromptWorkspace
) {
  assertWorkspaceCanManage(activeWorkspace);

  if (activeWorkspace.kind === "personal" && activeWorkspace.mode === "local") {
    const nextFolder = createFolder(name);
    const nextLibrary = {
      ...currentLibrary,
      folders: [...currentLibrary.folders, nextFolder].sort((left, right) => left.name.localeCompare(right.name)),
    };

    await saveLocalLibrary(nextLibrary);

    return {
      state: await loadPopupLibraryState(activeWorkspace.id),
    };
  }

  const signedInBillingContext = await requireSignedInBillingContext();
  const libraryId = await getCloudLibraryIdForWorkspace(signedInBillingContext.cloudContext.client, signedInBillingContext.cloudContext.user.id, activeWorkspace);
  const { error } = await signedInBillingContext.cloudContext.client.from("folders").insert({
    library_id: libraryId,
    name,
    position: currentLibrary.folders.length,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    state: await loadPopupLibraryState(activeWorkspace.id),
  };
}

export async function savePromptForCurrentMode({
  activeWorkspace,
  currentLibrary,
  draft,
  editingPromptId,
}: {
  activeWorkspace: PromptWorkspace;
  currentLibrary: LocalPromptLibrary;
  draft: PromptDraft;
  editingPromptId: string | null;
}): Promise<SavePromptResult> {
  assertWorkspaceCanManage(activeWorkspace);

  if (activeWorkspace.kind === "personal" && activeWorkspace.mode === "local") {
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
        state: await loadPopupLibraryState(activeWorkspace.id),
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
      state: await loadPopupLibraryState(activeWorkspace.id),
    };
  }

  const signedInBillingContext = await requireSignedInBillingContext();
  const libraryId = await getCloudLibraryIdForWorkspace(signedInBillingContext.cloudContext.client, signedInBillingContext.cloudContext.user.id, activeWorkspace);

  if (editingPromptId) {
    const { error } = await signedInBillingContext.cloudContext.client
      .from("prompts")
      .update({
        body: draft.body.trim(),
        description: draft.description.trim(),
        folder_id: draft.folderId,
        tags: normalizeTags(draft.tagsInput),
        title: draft.title.trim(),
      })
      .eq("id", editingPromptId)
      .eq("library_id", libraryId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      promptId: editingPromptId,
      state: await loadPopupLibraryState(activeWorkspace.id),
    };
  }

  const { data, error } = await signedInBillingContext.cloudContext.client
    .from("prompts")
    .insert({
      body: draft.body.trim(),
      created_by_user_id: signedInBillingContext.cloudContext.user.id,
      description: draft.description.trim(),
      folder_id: draft.folderId,
      library_id: libraryId,
      position: currentLibrary.prompts.length,
      tags: normalizeTags(draft.tagsInput),
      title: draft.title.trim(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    promptId: data.id,
    state: await loadPopupLibraryState(activeWorkspace.id),
  };
}

export async function deletePromptForCurrentMode(
  promptId: string,
  currentLibrary: LocalPromptLibrary,
  activeWorkspace: PromptWorkspace
) {
  assertWorkspaceCanManage(activeWorkspace);

  if (activeWorkspace.kind === "personal" && activeWorkspace.mode === "local") {
    const nextLibrary = {
      ...currentLibrary,
      prompts: currentLibrary.prompts.filter((prompt) => prompt.id !== promptId),
    };

    await saveLocalLibrary(nextLibrary);

    return loadPopupLibraryState(activeWorkspace.id);
  }

  const signedInBillingContext = await requireSignedInBillingContext();
  const libraryId = await getCloudLibraryIdForWorkspace(signedInBillingContext.cloudContext.client, signedInBillingContext.cloudContext.user.id, activeWorkspace);
  const { error } = await signedInBillingContext.cloudContext.client
    .from("prompts")
    .delete()
    .eq("id", promptId)
    .eq("library_id", libraryId);

  if (error) {
    throw new Error(error.message);
  }

  return loadPopupLibraryState(activeWorkspace.id);
}

export async function duplicatePromptForCurrentMode(
  prompt: PromptRecord,
  currentLibrary: LocalPromptLibrary,
  activeWorkspace: PromptWorkspace
): Promise<DuplicatePromptResult> {
  assertWorkspaceCanManage(activeWorkspace);

  if (activeWorkspace.kind === "personal" && activeWorkspace.mode === "local") {
    const nextPrompt = duplicatePromptRecord(prompt);
    const nextLibrary = {
      ...currentLibrary,
      prompts: [nextPrompt, ...currentLibrary.prompts],
    };

    await saveLocalLibrary(nextLibrary);

    return {
      promptId: nextPrompt.id,
      state: await loadPopupLibraryState(activeWorkspace.id),
    };
  }

  const signedInBillingContext = await requireSignedInBillingContext();
  const libraryId = await getCloudLibraryIdForWorkspace(signedInBillingContext.cloudContext.client, signedInBillingContext.cloudContext.user.id, activeWorkspace);
  const nextPrompt = duplicatePromptRecord(prompt);
  const { data, error } = await signedInBillingContext.cloudContext.client
    .from("prompts")
    .insert({
      body: nextPrompt.body,
      created_by_user_id: signedInBillingContext.cloudContext.user.id,
      description: nextPrompt.description,
      folder_id: nextPrompt.folderId,
      library_id: libraryId,
      position: currentLibrary.prompts.length,
      tags: nextPrompt.tags,
      title: nextPrompt.title,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    promptId: data.id,
    state: await loadPopupLibraryState(activeWorkspace.id),
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

async function getSignedInBillingContext(): Promise<SignedInBillingContext | null> {
  const cloudContext = await getCloudContext();

  if (!cloudContext) {
    return null;
  }

  let billing = createEmptyPersonalBillingSummary();

  try {
    billing = await loadPersonalBillingSummary(cloudContext.client, cloudContext.user.id);
  } catch {
    billing = createEmptyPersonalBillingSummary();
  }

  return {
    billing,
    cloudContext,
  };
}

async function requireSignedInBillingContext() {
  const signedInBillingContext = await getSignedInBillingContext();

  if (!signedInBillingContext) {
    throw new Error("Sign in to manage cloud workspaces.");
  }

  return signedInBillingContext;
}

async function loadActiveLibraryState({
  activeWorkspace,
  billing,
  cloudContext,
  localLibrary,
}: {
  activeWorkspace: PromptWorkspace;
  billing: PersonalBillingSummary;
  cloudContext: CloudContext;
  localLibrary: LocalPromptLibrary;
}): Promise<ActiveLibraryState> {
  if (activeWorkspace.kind === "personal") {
    return loadPersonalWorkspaceLibraryState({
      billing,
      cloudContext,
      localLibrary,
      workspace: activeWorkspace,
    });
  }

  return loadTeamWorkspaceLibraryState(cloudContext.client, activeWorkspace);
}

async function loadPersonalWorkspaceLibraryState({
  billing,
  cloudContext,
  localLibrary,
  workspace,
}: {
  billing: PersonalBillingSummary;
  cloudContext: CloudContext;
  localLibrary: LocalPromptLibrary;
  workspace: PromptWorkspace;
}): Promise<ActiveLibraryState> {
  const workspaceId = getPersonalWorkspaceId(cloudContext.user.id);

  if (!hasActivePersonalPlan(billing)) {
    return {
      lastSyncedAt: null,
      library: localLibrary,
      mode: "local",
      syncNotice: workspace.accessNotice,
    };
  }

  const cachedLibrary = await getCloudLibraryCache(workspaceId);
  const syncMetadata = await getCloudSyncMetadata(workspaceId);

  try {
    let remoteLibrary = await loadPersonalCloudLibrary(cloudContext.client, cloudContext.user.id);
    let importedLocalAt = syncMetadata.importedLocalAt;

    if (!importedLocalAt && shouldImportLocalLibrary(localLibrary, remoteLibrary)) {
      await importLocalLibraryToCloud(cloudContext.client, cloudContext.user, localLibrary);
      remoteLibrary = await loadPersonalCloudLibrary(cloudContext.client, cloudContext.user.id);
      importedLocalAt = new Date().toISOString();
    }

    const lastSyncedAt = new Date().toISOString();

    await saveCloudLibraryCache(workspaceId, remoteLibrary);
    await saveCloudSyncMetadata(workspaceId, {
      importedLocalAt,
      lastSyncedAt,
    });

    return {
      lastSyncedAt,
      library: remoteLibrary,
      mode: "cloud",
      syncNotice: importedLocalAt && !syncMetadata.importedLocalAt ? "Imported your local library into cloud sync." : null,
    };
  } catch {
    if (cachedLibrary) {
      return {
        lastSyncedAt: syncMetadata.lastSyncedAt,
        library: cachedLibrary,
        mode: "cloud",
        syncNotice: "Using the cached cloud library because the latest refresh failed.",
      };
    }

    return {
      lastSyncedAt: syncMetadata.lastSyncedAt,
      library: localLibrary,
      mode: "local",
      syncNotice: "Cloud sync is configured, but the cloud library could not be loaded. Using local storage for now.",
    };
  }
}

async function loadTeamWorkspaceLibraryState(client: SupabaseClient, workspace: PromptWorkspace): Promise<ActiveLibraryState> {
  if (workspace.access !== "ready" || !workspace.libraryId) {
    return {
      lastSyncedAt: null,
      library: createEmptyLibrary(),
      mode: "cloud",
      syncNotice: workspace.accessNotice,
    };
  }

  const cachedLibrary = await getCloudLibraryCache(workspace.id);
  const syncMetadata = await getCloudSyncMetadata(workspace.id);

  try {
    const remoteLibrary = await loadCloudLibraryById(client, workspace.libraryId);
    const lastSyncedAt = new Date().toISOString();

    await saveCloudLibraryCache(workspace.id, remoteLibrary);
    await saveCloudSyncMetadata(workspace.id, {
      importedLocalAt: null,
      lastSyncedAt,
    });

    return {
      lastSyncedAt,
      library: remoteLibrary,
      mode: "cloud",
      syncNotice: null,
    };
  } catch {
    if (cachedLibrary) {
      return {
        lastSyncedAt: syncMetadata.lastSyncedAt,
        library: cachedLibrary,
        mode: "cloud",
        syncNotice: "Using the cached shared library because the latest refresh failed.",
      };
    }

    return {
      lastSyncedAt: syncMetadata.lastSyncedAt,
      library: createEmptyLibrary(),
      mode: "cloud",
      syncNotice: "The shared team library could not be loaded right now.",
    };
  }
}

function createPersonalWorkspace(userId: string, billing: PersonalBillingSummary): PromptWorkspace {
  const hasActivePlan = hasActivePersonalPlan(billing);

  return {
    access: "ready",
    accessNotice: hasActivePlan ? null : getPersonalPlanGateNotice(billing),
    canEdit: true,
    id: getPersonalWorkspaceId(userId),
    kind: "personal",
    label: "Personal",
    libraryId: null,
    mode: hasActivePlan ? "cloud" : "local",
    role: null,
    teamId: null,
  };
}

async function loadTeamWorkspaces(client: SupabaseClient, userId: string): Promise<PromptWorkspace[]> {
  const memberships = await loadTeamMemberships(client, userId);

  if (!memberships.length) {
    return [];
  }

  const accessibleLibraries = await loadAccessibleTeamLibraries(client);
  const accessibleLibrariesByTeamId = new Map<string, TeamLibraryRecord>();

  for (const library of accessibleLibraries) {
    const existingLibrary = accessibleLibrariesByTeamId.get(library.teamId);

    if (!existingLibrary || shouldPreferTeamLibrary(library, existingLibrary)) {
      accessibleLibrariesByTeamId.set(library.teamId, library);
    }
  }

  return memberships.map((membership) => {
    const accessibleLibrary = accessibleLibrariesByTeamId.get(membership.teamId);
    const hasAccess = Boolean(accessibleLibrary);

    return {
      access: hasAccess ? "ready" : "billing_required",
      accessNotice: hasAccess ? null : getTeamPlanGateNotice(membership.teamName),
      canEdit: hasAccess && membership.role !== "member",
      id: getTeamWorkspaceId(membership.teamId),
      kind: "team",
      label: membership.teamName,
      libraryId: accessibleLibrary?.id ?? null,
      mode: "cloud",
      role: membership.role,
      teamId: membership.teamId,
    } satisfies PromptWorkspace;
  });
}

async function loadActiveTeamInvites(client: SupabaseClient, activeWorkspace: PromptWorkspace): Promise<TeamInviteSummary[]> {
  if (!canManageTeamInvites(activeWorkspace) || !activeWorkspace.teamId) {
    return [];
  }

  const { data, error } = await client
    .from("team_invites")
    .select("id, email, role, token, expires_at, created_at")
    .eq("team_id", activeWorkspace.teamId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((invite) => ({
    createdAt: invite.created_at,
    email: invite.email,
    expiresAt: invite.expires_at,
    id: invite.id,
    inviteUrl: buildInviteUrl(invite.token),
    role: invite.role as TeamInviteRole,
    token: invite.token,
  }));
}

async function loadTeamMemberships(client: SupabaseClient, userId: string): Promise<TeamMembershipRecord[]> {
  const { data: membershipRows, error: membershipError } = await client
    .from("team_memberships")
    .select("team_id, role")
    .eq("user_id", userId)
    .order("created_at");

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const teamIds = Array.from(new Set((membershipRows ?? []).map((membership) => membership.team_id)));

  if (!teamIds.length) {
    return [];
  }

  const { data: teamRows, error: teamError } = await client
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  if (teamError) {
    throw new Error(teamError.message);
  }

  const teamMap = new Map((teamRows ?? []).map((team) => [team.id, team.name]));

  return (membershipRows ?? [])
    .filter((membership) => teamMap.has(membership.team_id))
    .map((membership) => ({
      role: membership.role as TeamRole,
      teamId: membership.team_id,
      teamName: teamMap.get(membership.team_id) ?? "Team workspace",
    }));
}

async function loadAccessibleTeamLibraries(client: SupabaseClient): Promise<TeamLibraryRecord[]> {
  const { data, error } = await client
    .from("libraries")
    .select("id, name, team_id, created_at")
    .eq("scope", "team");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((library) => typeof library.team_id === "string")
    .map((library) => ({
      createdAt: library.created_at,
      id: library.id,
      name: library.name,
      teamId: library.team_id as string,
    }));
}

function shouldPreferTeamLibrary(candidate: TeamLibraryRecord, current: TeamLibraryRecord) {
  if (candidate.name === TEAM_SHARED_LIBRARY_NAME && current.name !== TEAM_SHARED_LIBRARY_NAME) {
    return true;
  }

  if (candidate.name !== TEAM_SHARED_LIBRARY_NAME && current.name === TEAM_SHARED_LIBRARY_NAME) {
    return false;
  }

  return Date.parse(candidate.createdAt) < Date.parse(current.createdAt);
}

function canManageTeamInvites(workspace: PromptWorkspace) {
  return workspace.kind === "team" && (workspace.role === "owner" || workspace.role === "admin");
}

async function getCloudLibraryIdForWorkspace(client: SupabaseClient, userId: string, workspace: PromptWorkspace) {
  if (workspace.kind === "personal") {
    const personalLibrary = await getPersonalLibraryRecord(client, userId);
    return personalLibrary.id;
  }

  if (!workspace.libraryId) {
    throw new Error(workspace.accessNotice ?? "The team workspace is not available yet.");
  }

  return workspace.libraryId;
}

async function getPersonalLibraryRecord(client: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await client
      .from("libraries")
      .select("id")
      .eq("scope", "personal")
      .eq("owner_user_id", userId)
      .limit(1)
      .single<{ id: string }>();

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
  return loadCloudLibraryById(client, personalLibrary.id);
}

async function loadCloudLibraryById(client: SupabaseClient, libraryId: string): Promise<LocalPromptLibrary> {
  const [foldersResult, promptsResult] = await Promise.all([
    client.from("folders").select("id, name, position, created_at").eq("library_id", libraryId).order("position"),
    client
      .from("prompts")
      .select("id, title, description, body, tags, folder_id, created_at, updated_at")
      .eq("library_id", libraryId)
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
      .single<{ id: string }>();

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

async function ensureTeamSharedLibrary(client: SupabaseClient, teamId: string, userId: string) {
  const { error } = await client.from("libraries").insert({
    created_by_user_id: userId,
    name: TEAM_SHARED_LIBRARY_NAME,
    scope: "team",
    team_id: teamId,
  });

  if (error && !isUniqueConstraintError(error)) {
    throw new Error(error.message);
  }
}

function summarizeUser(user: User): AccountSummary {
  return {
    email: user.email ?? "Signed-in user",
    userId: user.id,
  };
}

async function loadPersonalBillingSummary(client: SupabaseClient, userId: string): Promise<PersonalBillingSummary> {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan_key, status, current_period_end")
    .eq("scope", "individual")
    .eq("profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      current_period_end: string | null;
      plan_key: SubscriptionPlanKey;
      status: SubscriptionStatus;
    }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    currentPeriodEnd: data?.current_period_end ?? null,
    planKey: data?.plan_key ?? null,
    status: data?.status ?? null,
  };
}

function createEmptyPersonalBillingSummary(): PersonalBillingSummary {
  return {
    currentPeriodEnd: null,
    planKey: null,
    status: null,
  };
}

function hasActivePersonalPlan(billing: PersonalBillingSummary) {
  return billing.planKey === "individual" && isActiveSubscriptionStatus(billing.status);
}

function getPersonalPlanGateNotice(billing: PersonalBillingSummary) {
  if (!billing.status) {
    return "Cloud sync requires an active individual plan. Using local storage for now.";
  }

  return `Your individual plan is ${formatSubscriptionStatus(billing.status)}. Cloud sync stays in local mode until it becomes active.`;
}

function getTeamPlanGateNotice(teamName: string) {
  return `${teamName} needs an active team plan before the shared library unlocks.`;
}

function formatSubscriptionStatus(status: SubscriptionStatus) {
  return status.replaceAll("_", " ");
}

function createLocalOnlyPopupState(
  library: LocalPromptLibrary,
  options?: {
    cloudConfigured?: boolean;
  }
): PopupLibraryState {
  const activeWorkspace: PromptWorkspace = {
    access: "ready",
    accessNotice: null,
    canEdit: true,
    id: getLocalPersonalWorkspaceId(),
    kind: "personal",
    label: "Personal",
    libraryId: null,
    mode: "local",
    role: null,
    teamId: null,
  };

  return {
    account: null,
    activeWorkspace,
    billing: createEmptyPersonalBillingSummary(),
    cloudConfigured: options?.cloudConfigured ?? getSupabaseRuntimeConfig().configured,
    lastSyncedAt: null,
    library,
    mode: "local",
    syncNotice: null,
    teamInvites: [],
    workspaces: [activeWorkspace],
  };
}

function assertWorkspaceCanManage(workspace: PromptWorkspace) {
  if (workspace.access !== "ready") {
    throw new Error(workspace.accessNotice ?? "This workspace is not available yet.");
  }

  if (!workspace.canEdit) {
    throw new Error("This shared workspace is read-only for your role.");
  }
}

function isUniqueConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505";
}
