import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PromptWorkspace } from "../../extension/src/lib/types";
import {
  createTeamSlugCandidate,
  getLocalPersonalWorkspaceId,
  getTeamWorkspaceId,
  resolveWorkspaceSelection,
  sortWorkspaces,
} from "../../extension/src/lib/workspaces";

describe("workspace helpers", () => {
  it("creates stable team slug candidates", () => {
    assert.equal(createTeamSlugCandidate("Acme Editorial Team"), "acme-editorial-team");
    assert.equal(createTeamSlugCandidate("AI"), "team-ai");
    assert.equal(createTeamSlugCandidate("   "), "team-workspace");
  });

  it("resolves the preferred workspace when it exists", () => {
    const workspaces = createWorkspaceFixtures();

    assert.equal(resolveWorkspaceSelection(workspaces, getTeamWorkspaceId("team-2")), getTeamWorkspaceId("team-2"));
  });

  it("falls back to personal when the preferred workspace is missing", () => {
    const workspaces = createWorkspaceFixtures();

    assert.equal(resolveWorkspaceSelection(workspaces, "missing"), "personal:user-1");
  });

  it("sorts personal before team workspaces", () => {
    const workspaces = sortWorkspaces([
      createWorkspace({
        id: getTeamWorkspaceId("team-2"),
        kind: "team",
        label: "Zebra",
      }),
      createWorkspace({
        id: "personal:user-1",
        kind: "personal",
        label: "Personal",
        mode: "local",
        role: null,
        teamId: null,
      }),
      createWorkspace({
        id: getTeamWorkspaceId("team-1"),
        kind: "team",
        label: "Alpha",
      }),
    ]);

    assert.deepEqual(
      workspaces.map((workspace) => workspace.id),
      ["personal:user-1", getTeamWorkspaceId("team-1"), getTeamWorkspaceId("team-2")]
    );
  });

  it("uses the local personal fallback when no workspaces exist", () => {
    assert.equal(resolveWorkspaceSelection([], null), getLocalPersonalWorkspaceId());
  });
});

function createWorkspaceFixtures(): PromptWorkspace[] {
  return [
    createWorkspace({
      id: "personal:user-1",
      kind: "personal",
      label: "Personal",
      mode: "local",
      role: null,
      teamId: null,
    }),
    createWorkspace({
      id: getTeamWorkspaceId("team-1"),
      kind: "team",
      label: "Alpha",
    }),
    createWorkspace({
      id: getTeamWorkspaceId("team-2"),
      kind: "team",
      label: "Beta",
    }),
  ];
}

function createWorkspace(overrides: Partial<PromptWorkspace>): PromptWorkspace {
  return {
    access: "ready",
    accessNotice: null,
    canEdit: true,
    id: overrides.id ?? "workspace-1",
    kind: overrides.kind ?? "team",
    label: overrides.label ?? "Workspace",
    libraryId: overrides.libraryId ?? null,
    mode: overrides.mode ?? "cloud",
    role: overrides.role ?? "owner",
    teamId: overrides.teamId ?? "team-1",
  };
}
