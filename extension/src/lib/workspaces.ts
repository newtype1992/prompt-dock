import type { LocalPromptLibrary, PromptWorkspace, TeamRole } from "./types";

const LOCAL_PERSONAL_WORKSPACE_ID = "personal-local";

export function createEmptyLibrary(): LocalPromptLibrary {
  return {
    version: 1,
    folders: [],
    prompts: [],
  };
}

export function getLocalPersonalWorkspaceId() {
  return LOCAL_PERSONAL_WORKSPACE_ID;
}

export function getPersonalWorkspaceId(userId: string) {
  return `personal:${userId}`;
}

export function getTeamWorkspaceId(teamId: string) {
  return `team:${teamId}`;
}

export function resolveWorkspaceSelection(workspaces: PromptWorkspace[], preferredWorkspaceId?: string | null) {
  if (preferredWorkspaceId && workspaces.some((workspace) => workspace.id === preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }

  const personalWorkspace = workspaces.find((workspace) => workspace.kind === "personal");

  if (personalWorkspace) {
    return personalWorkspace.id;
  }

  return workspaces[0]?.id ?? LOCAL_PERSONAL_WORKSPACE_ID;
}

export function createTeamSlugCandidate(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!normalized) {
    return "team-workspace";
  }

  if (normalized.length >= 3) {
    return normalized;
  }

  return `team-${normalized}`;
}

export function formatTeamRole(role: TeamRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function sortWorkspaces(workspaces: PromptWorkspace[]) {
  return [...workspaces].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "personal" ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}
