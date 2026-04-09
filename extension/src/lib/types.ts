export type PromptFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type TeamRole = "owner" | "admin" | "member";

export type TeamInviteRole = Exclude<TeamRole, "owner">;

export type WorkspaceKind = "personal" | "team";

export type WorkspaceMode = "local" | "cloud";

export type WorkspaceAccess = "ready" | "billing_required";

export type PromptRecord = {
  id: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalPromptLibrary = {
  version: 1;
  folders: PromptFolder[];
  prompts: PromptRecord[];
};

export type PromptWorkspace = {
  access: WorkspaceAccess;
  accessNotice: string | null;
  canEdit: boolean;
  id: string;
  kind: WorkspaceKind;
  label: string;
  libraryId: string | null;
  mode: WorkspaceMode;
  role: TeamRole | null;
  teamId: string | null;
};

export type TeamInviteSummary = {
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  inviteUrl: string;
  role: TeamInviteRole;
  token: string;
};

export type PromptDraft = {
  title: string;
  description: string;
  body: string;
  tagsInput: string;
  folderId: string | null;
};
