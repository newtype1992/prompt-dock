import { useCallback, useEffect, useRef, useState } from "react";
import {
  isActiveSubscriptionStatus,
  type SubscriptionPlanKey,
  type SubscriptionStatus,
} from "@/lib/billing/subscriptions";
import { PRODUCT_NAME } from "@/lib/product/config";
import { startBillingFlow } from "../lib/billing";
import {
  createFolderForCurrentMode,
  createInviteForActiveTeamWorkspace,
  createTeamWorkspace,
  deletePromptForCurrentMode,
  duplicatePromptForCurrentMode,
  loadPopupLibraryState,
  refreshCloudLibrary,
  savePromptForCurrentMode,
  signInWithPassword,
  signOutFromCloud,
  signUpWithPassword,
  switchWorkspace,
  acceptInviteFromInput,
  type PopupLibraryState,
} from "../lib/cloud-sync";
import { getActiveSiteSummary, injectPromptFromPopup } from "../lib/injection";
import { createEmptyPromptDraft, draftFromPrompt } from "../lib/storage";
import type { LocalPromptLibrary, PromptDraft, PromptRecord, PromptWorkspace, TeamInviteRole, TeamInviteSummary } from "../lib/types";
import { NoticeBanner, PageNavButton, type PopupNotice } from "./components";
import { AccountPage } from "./pages/account-page";
import { EditorPage } from "./pages/editor-page";
import { LibraryPage } from "./pages/library-page";

type DockPage = "library" | "editor" | "account";

export default function App() {
  const [library, setLibrary] = useState<LocalPromptLibrary | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<PromptWorkspace | null>(null);
  const [workspaces, setWorkspaces] = useState<PromptWorkspace[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInviteSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft>(createEmptyPromptDraft());
  const [newFolderName, setNewFolderName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamInviteRole>("member");
  const [inviteInput, setInviteInput] = useState("");
  const [siteLabel, setSiteLabel] = useState("Checking active tab...");
  const [siteSupported, setSiteSupported] = useState(false);
  const [notice, setNotice] = useState<PopupNotice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [injectingPromptId, setInjectingPromptId] = useState<string | null>(null);
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [libraryMode, setLibraryMode] = useState<"local" | "cloud">("local");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<SubscriptionStatus | null>(null);
  const [billingPlanKey, setBillingPlanKey] = useState<SubscriptionPlanKey | null>(null);
  const [billingCurrentPeriodEnd, setBillingCurrentPeriodEnd] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authIntent, setAuthIntent] = useState<"signIn" | "signUp">("signIn");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isBillingSubmitting, setIsBillingSubmitting] = useState(false);
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isTeamSubmitting, setIsTeamSubmitting] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isInviteAccepting, setIsInviteAccepting] = useState(false);
  const [page, setPage] = useState<DockPage>(() => getPageFromHash());
  const activeFolderIdRef = useRef(activeFolderId);
  const editingPromptIdRef = useRef(editingPromptId);

  useEffect(() => {
    activeFolderIdRef.current = activeFolderId;
  }, [activeFolderId]);

  useEffect(() => {
    editingPromptIdRef.current = editingPromptId;
  }, [editingPromptId]);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", getHashForPage("library"));
    }

    const handleHashChange = () => {
      setPage(getPageFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const applyPopupLibraryState = useCallback((nextState: PopupLibraryState, preferredPromptId?: string | null) => {
    const currentActiveFolderId = activeFolderIdRef.current;
    const currentEditingPromptId = editingPromptIdRef.current;

    setLibrary(nextState.library);
    setActiveWorkspace(nextState.activeWorkspace);
    setTeamInvites(nextState.teamInvites);
    setWorkspaces(nextState.workspaces);
    setCloudConfigured(nextState.cloudConfigured);
    setLibraryMode(nextState.mode);
    setLastSyncedAt(nextState.lastSyncedAt);
    setAccountEmail(nextState.account?.email ?? null);
    setBillingStatus(nextState.billing.status);
    setBillingPlanKey(nextState.billing.planKey);
    setBillingCurrentPeriodEnd(nextState.billing.currentPeriodEnd);

    const folderStillExists =
      currentActiveFolderId === "all" ||
      nextState.library.folders.some((folder) => folder.id === currentActiveFolderId);

    if (!folderStillExists) {
      setActiveFolderId("all");
    }

    const nextPrompt =
      (preferredPromptId ? nextState.library.prompts.find((prompt) => prompt.id === preferredPromptId) : null) ??
      (currentEditingPromptId ? nextState.library.prompts.find((prompt) => prompt.id === currentEditingPromptId) : null) ??
      sortPromptRecords(nextState.library.prompts)[0];

    if (nextPrompt) {
      setEditingPromptId(nextPrompt.id);
      setDraft(draftFromPrompt(nextPrompt));
      return;
    }

    setEditingPromptId(null);
    setDraft(createEmptyPromptDraft(currentActiveFolderId === "all" ? null : currentActiveFolderId));
  }, []);

  const loadPopupData = useCallback(
    async (preferredPromptId?: string | null) => {
      setIsLoading(true);

      try {
        const [nextState, nextSiteSummary] = await Promise.all([loadPopupLibraryState(), getActiveSiteSummary()]);

        applyPopupLibraryState(nextState, preferredPromptId);
        setSiteLabel(nextSiteSummary.label);
        setSiteSupported(nextSiteSummary.supported);

        if (nextState.syncNotice) {
          setNotice({
            tone: "info",
            message: nextState.syncNotice,
          });
        }
      } catch (error) {
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "The side panel could not be loaded.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [applyPopupLibraryState]
  );

  useEffect(() => {
    void loadPopupData();
  }, [loadPopupData]);

  function selectPrompt(prompt: PromptRecord) {
    setEditingPromptId(prompt.id);
    setDraft(draftFromPrompt(prompt));
    navigateToPage("editor", setPage);
  }

  function beginCreatePrompt() {
    if (activeWorkspace && !activeWorkspace.canEdit) {
      setNotice({
        tone: "info",
        message: getWorkspaceReadOnlyMessage(activeWorkspace),
      });
      return;
    }

    setEditingPromptId(null);
    setDraft(createEmptyPromptDraft(activeFolderId === "all" ? null : activeFolderId));
    navigateToPage("editor", setPage);
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authEmail.trim() || !authPassword.trim()) {
      setNotice({
        tone: "error",
        message: "Email and password are required for cloud auth.",
      });
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const result =
        authIntent === "signIn"
          ? await signInWithPassword(authEmail.trim(), authPassword)
          : await signUpWithPassword(authEmail.trim(), authPassword);

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.state) {
        applyPopupLibraryState(result.state);
        setAuthPassword("");
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsAuthSubmitting(true);

    try {
      const nextState = await signOutFromCloud();
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "info",
        message: "Signed out. Prompt Dock is back in local-only mode.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Sign-out failed.",
      });
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleRefreshCloud() {
    setIsRefreshingCloud(true);

    try {
      const nextState = await refreshCloudLibrary(activeWorkspace?.id);
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message: getRefreshMessage(nextState),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The library could not be refreshed.",
      });
    } finally {
      setIsRefreshingCloud(false);
    }
  }

  async function handleWorkspaceSwitch(workspaceId: string) {
    if (!activeWorkspace || workspaceId === activeWorkspace.id) {
      return;
    }

    setIsRefreshingCloud(true);

    try {
      const nextState = await switchWorkspace(workspaceId);
      applyPopupLibraryState(nextState);
      setNotice({
        tone: nextState.activeWorkspace.access === "ready" ? "success" : "info",
        message: getWorkspaceSwitchMessage(nextState),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The workspace could not be opened.",
      });
    } finally {
      setIsRefreshingCloud(false);
    }
  }

  async function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teamName.trim()) {
      setNotice({
        tone: "error",
        message: "Enter a team name before creating the workspace.",
      });
      return;
    }

    setIsTeamSubmitting(true);

    try {
      const result = await createTeamWorkspace(teamName);
      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.state) {
        applyPopupLibraryState(result.state);
        setTeamName("");
        navigateToPage("library", setPage);
      }
    } finally {
      setIsTeamSubmitting(false);
    }
  }

  async function handleOpenCheckout() {
    setIsBillingSubmitting(true);

    try {
      const flowResult = await startBillingFlow({
        kind: "checkout",
        scope: "individual",
      });
      const nextState = await refreshCloudStateAfterBillingReturn({
        returnStatus: flowResult.status,
        scope: "individual",
        workspaceId: activeWorkspace?.id ?? null,
      });
      applyPopupLibraryState(nextState);
      setNotice({
        tone: nextState.mode === "cloud" ? "success" : flowResult.status === "canceled" ? "info" : "info",
        message: getBillingNoticeMessage(flowResult.status, nextState),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The upgrade flow could not be started.",
      });
    } finally {
      setIsBillingSubmitting(false);
    }
  }

  async function handleOpenBillingPortal() {
    setIsBillingSubmitting(true);

    try {
      const flowResult = await startBillingFlow({
        kind: "portal",
        scope: "individual",
      });
      const nextState = await refreshCloudStateAfterBillingReturn({
        returnStatus: flowResult.status,
        scope: "individual",
        workspaceId: activeWorkspace?.id ?? null,
      });
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message:
          flowResult.status === "portal"
            ? "Billing settings refreshed."
            : nextState.mode === "cloud"
              ? "Cloud billing is still active."
              : "Billing status refreshed.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The billing portal could not be opened.",
      });
    } finally {
      setIsBillingSubmitting(false);
    }
  }

  async function handleOpenTeamCheckout(workspace: PromptWorkspace) {
    if (workspace.kind !== "team" || !workspace.teamId) {
      return;
    }

    setIsBillingSubmitting(true);

    try {
      const flowResult = await startBillingFlow({
        kind: "checkout",
        scope: "team",
        teamId: workspace.teamId,
      });
      const nextState = await refreshCloudStateAfterBillingReturn({
        returnStatus: flowResult.status,
        scope: "team",
        workspaceId: workspace.id,
      });
      applyPopupLibraryState(nextState);
      setNotice({
        tone: nextState.activeWorkspace.access === "ready" ? "success" : flowResult.status === "canceled" ? "info" : "info",
        message: getTeamBillingNoticeMessage(flowResult.status, nextState, workspace),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The team upgrade flow could not be started.",
      });
    } finally {
      setIsBillingSubmitting(false);
    }
  }

  async function handleOpenTeamBillingPortal(workspace: PromptWorkspace) {
    if (workspace.kind !== "team" || !workspace.teamId) {
      return;
    }

    setIsBillingSubmitting(true);

    try {
      const flowResult = await startBillingFlow({
        kind: "portal",
        scope: "team",
        teamId: workspace.teamId,
      });
      const nextState = await refreshCloudStateAfterBillingReturn({
        returnStatus: flowResult.status,
        scope: "team",
        workspaceId: workspace.id,
      });
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message:
          flowResult.status === "portal"
            ? `${workspace.label} billing settings refreshed.`
            : nextState.activeWorkspace.access === "ready"
              ? `${workspace.label} billing is still active.`
              : `${workspace.label} billing status refreshed.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The team billing portal could not be opened.",
      });
    } finally {
      setIsBillingSubmitting(false);
    }
  }

  async function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace) {
      return;
    }

    if (!inviteEmail.trim()) {
      setNotice({
        tone: "error",
        message: "Enter an email before creating the invite.",
      });
      return;
    }

    setIsInviteSubmitting(true);

    try {
      const result = await createInviteForActiveTeamWorkspace({
        activeWorkspace,
        email: inviteEmail,
        role: inviteRole,
      });

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.ok
          ? (await copyInviteToClipboard(result.invite?.inviteUrl ?? null))
            ? `Invite link copied for ${result.invite?.email}.`
            : `Invite created for ${result.invite?.email}.`
          : result.message,
      });

      if (result.state) {
        applyPopupLibraryState(result.state);
        setInviteEmail("");
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The team invite could not be created.",
      });
    } finally {
      setIsInviteSubmitting(false);
    }
  }

  async function handleAcceptInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteInput.trim()) {
      setNotice({
        tone: "error",
        message: "Paste an invite link or token before trying to join a team.",
      });
      return;
    }

    setIsInviteAccepting(true);

    try {
      const result = await acceptInviteFromInput(inviteInput);
      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.state) {
        applyPopupLibraryState(result.state);
        setInviteInput("");
        navigateToPage("library", setPage);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The invite could not be accepted.",
      });
    } finally {
      setIsInviteAccepting(false);
    }
  }

  async function handleCopyInviteLink(inviteUrl: string, email: string) {
    const copied = await copyInviteToClipboard(inviteUrl);

    setNotice({
      tone: copied ? "success" : "info",
      message: copied ? `Copied invite link for ${email}.` : `Invite link for ${email}: ${inviteUrl}`,
    });
  }

  async function refreshCloudStateAfterBillingReturn({
    returnStatus,
    scope,
    workspaceId,
  }: {
    returnStatus: "success" | "canceled" | "portal" | null;
    scope: "individual" | "team";
    workspaceId: string | null;
  }) {
    if (returnStatus !== "success") {
      return refreshCloudLibrary(workspaceId);
    }

    let latestState = await refreshCloudLibrary(workspaceId);

    if (hasBillingActivatedForScope(scope, workspaceId, latestState)) {
      return latestState;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await wait(1200);
      latestState = await refreshCloudLibrary(workspaceId);

      if (hasBillingActivatedForScope(scope, workspaceId, latestState)) {
        return latestState;
      }
    }

    return latestState;
  }

  async function handleSavePrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!library || !activeWorkspace) {
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

    try {
      const result = await savePromptForCurrentMode({
        activeWorkspace,
        currentLibrary: library,
        draft,
        editingPromptId,
      });

      applyPopupLibraryState(result.state, result.promptId);
      setNotice({
        tone: "success",
        message: getPromptSaveMessage(result.state, editingPromptId),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The prompt could not be saved.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!library || !activeWorkspace) {
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

    const duplicateFolder = library.folders.find((folder) => folder.name.toLowerCase() === folderName.toLowerCase());

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

    try {
      const result = await createFolderForCurrentMode(folderName, library, activeWorkspace);
      const createdFolder =
        result.state.library.folders.find((folder) => folder.name.toLowerCase() === folderName.toLowerCase()) ?? null;

      applyPopupLibraryState(result.state);
      setNewFolderName("");

      if (createdFolder) {
        setActiveFolderId(createdFolder.id);
        setDraft((currentDraft) => ({
          ...currentDraft,
          folderId: createdFolder.id,
        }));
      }

      setNotice({
        tone: "success",
        message: getFolderCreateMessage(folderName, result.state),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The folder could not be created.",
      });
    }
  }

  async function handleDeletePrompt(promptId: string) {
    if (!library || !activeWorkspace) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    if (!window.confirm(`Delete "${prompt.title}" from ${getWorkspaceDeleteTarget(activeWorkspace, libraryMode)}?`)) {
      return;
    }

    try {
      const nextState = await deletePromptForCurrentMode(promptId, library, activeWorkspace);
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message: getPromptDeleteMessage(nextState),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The prompt could not be deleted.",
      });
    }
  }

  async function handleDuplicatePrompt(promptId: string) {
    if (!library || !activeWorkspace) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    try {
      const result = await duplicatePromptForCurrentMode(prompt, library, activeWorkspace);
      applyPopupLibraryState(result.state, result.promptId);
      setNotice({
        tone: "success",
        message: getPromptDuplicateMessage(prompt.title, result.state),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The prompt could not be duplicated.",
      });
    }
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

  if (isLoading || !library || !activeWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-600">
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

  const accountSignedIn = Boolean(accountEmail);
  const selectedPrompt = editingPromptId ? library.prompts.find((prompt) => prompt.id === editingPromptId) ?? null : null;

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 text-slate-900">
      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_48px_-34px_rgba(28,42,66,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                getWorkspaceBadgeClass(activeWorkspace, libraryMode)
              }`}
            >
              {getWorkspaceBadgeLabel(activeWorkspace, libraryMode)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {activeWorkspace.kind === "team"
                  ? `${activeWorkspace.label} is active in the side panel.`
                  : "Prompt Dock now uses page-based navigation inside the extension side panel."}
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

      <nav className="grid grid-cols-3 gap-2 rounded-[24px] border border-slate-200/70 bg-white/85 p-2 shadow-[0_18px_40px_-34px_rgba(28,42,66,0.4)]">
        <PageNavButton
          active={page === "library"}
          description={`${library.prompts.length} prompts`}
          label="Library"
          onClick={() => navigateToPage("library", setPage)}
        />
        <PageNavButton
          active={page === "editor"}
          description={editingPromptId ? "Active draft" : activeWorkspace.canEdit ? "Create prompt" : "View prompt"}
          label="Editor"
          onClick={() => navigateToPage("editor", setPage)}
        />
        <PageNavButton
          active={page === "account"}
          description={accountSignedIn ? "Signed in" : "Local mode"}
          label="Account"
          onClick={() => navigateToPage("account", setPage)}
        />
      </nav>

      {page === "library" ? (
        <LibraryPage
          activeFolderId={activeFolderId}
          activeWorkspace={activeWorkspace}
          injectingPromptId={injectingPromptId}
          isSwitchingWorkspace={isRefreshingCloud}
          library={library}
          libraryMode={libraryMode}
          newFolderName={newFolderName}
          searchTerm={searchTerm}
          selectedPromptId={editingPromptId}
          visiblePrompts={visiblePrompts}
          workspaces={workspaces}
          onBeginCreatePrompt={beginCreatePrompt}
          onChangeNewFolderName={setNewFolderName}
          onChangeSearchTerm={setSearchTerm}
          onClearFilter={() => setActiveFolderId("all")}
          onCreateFolder={(event) => void handleCreateFolder(event)}
          onDeletePrompt={(promptId) => void handleDeletePrompt(promptId)}
          onDuplicatePrompt={(promptId) => void handleDuplicatePrompt(promptId)}
          onGoToAccount={() => navigateToPage("account", setPage)}
          onInjectPrompt={(prompt) => void handleInjectPrompt(prompt)}
          onSelectFolder={setActiveFolderId}
          onSelectPrompt={selectPrompt}
          onSelectWorkspace={(workspaceId) => void handleWorkspaceSwitch(workspaceId)}
        />
      ) : null}

      {page === "editor" ? (
        <EditorPage
          activeWorkspace={activeWorkspace}
          draft={draft}
          editingPromptId={editingPromptId}
          isSaving={isSaving}
          library={library}
          libraryMode={libraryMode}
          selectedPrompt={selectedPrompt}
          onBeginCreatePrompt={beginCreatePrompt}
          onChangeDraft={setDraft}
          onDeletePrompt={(promptId) => void handleDeletePrompt(promptId)}
          onDuplicatePrompt={(promptId) => void handleDuplicatePrompt(promptId)}
          onGoToAccount={() => navigateToPage("account", setPage)}
          onGoToLibrary={() => navigateToPage("library", setPage)}
          onSavePrompt={(event) => void handleSavePrompt(event)}
        />
      ) : null}

      {page === "account" ? (
        <AccountPage
          accountEmail={accountEmail}
          activeWorkspaceId={activeWorkspace.id}
          authEmail={authEmail}
          authIntent={authIntent}
          authPassword={authPassword}
          billingCurrentPeriodEnd={billingCurrentPeriodEnd}
          billingPlanKey={billingPlanKey}
          billingStatus={billingStatus}
          cloudConfigured={cloudConfigured}
          isAuthSubmitting={isAuthSubmitting}
          isBillingSubmitting={isBillingSubmitting}
          isRefreshingCloud={isRefreshingCloud}
          isInviteAccepting={isInviteAccepting}
          isInviteSubmitting={isInviteSubmitting}
          isTeamSubmitting={isTeamSubmitting}
          lastSyncedAt={lastSyncedAt}
          libraryMode={libraryMode}
          inviteEmail={inviteEmail}
          inviteInput={inviteInput}
          inviteRole={inviteRole}
          activeWorkspace={activeWorkspace}
          teamName={teamName}
          teamInvites={teamInvites}
          workspaces={workspaces}
          onChangeAuthEmail={setAuthEmail}
          onChangeAuthIntent={setAuthIntent}
          onChangeAuthPassword={setAuthPassword}
          onChangeTeamName={setTeamName}
          onChangeInviteEmail={setInviteEmail}
          onChangeInviteInput={setInviteInput}
          onChangeInviteRole={setInviteRole}
          onCopyInviteLink={(inviteUrl, email) => void handleCopyInviteLink(inviteUrl, email)}
          onCreateTeam={(event) => void handleCreateTeam(event)}
          onCreateInvite={(event) => void handleCreateInvite(event)}
          onAcceptInvite={(event) => void handleAcceptInvite(event)}
          onOpenBillingPortal={() => void handleOpenBillingPortal()}
          onOpenCheckout={() => void handleOpenCheckout()}
          onOpenTeamBillingPortal={(workspace) => void handleOpenTeamBillingPortal(workspace)}
          onOpenTeamCheckout={(workspace) => void handleOpenTeamCheckout(workspace)}
          onRefreshCloud={() => void handleRefreshCloud()}
          onSelectWorkspace={(workspaceId) => void handleWorkspaceSwitch(workspaceId)}
          onSignOut={() => void handleSignOut()}
          onSubmitAuth={(event) => void handleAuthSubmit(event)}
        />
      ) : null}
    </div>
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

function getPageFromHash(): DockPage {
  const hash = window.location.hash.replace(/^#\/?/, "");

  if (hash === "editor" || hash === "account") {
    return hash;
  }

  return "library";
}

function getHashForPage(page: DockPage) {
  return `#/${page}`;
}

function navigateToPage(page: DockPage, setPage: (page: DockPage) => void) {
  const nextHash = getHashForPage(page);

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
    return;
  }

  setPage(page);
}

function getBillingNoticeMessage(
  returnStatus: "success" | "canceled" | "portal" | null,
  nextState: PopupLibraryState
) {
  if (nextState.billing.planKey === "individual" && isActiveSubscriptionStatus(nextState.billing.status)) {
    return nextState.mode === "cloud"
      ? "Individual billing is active. Personal cloud sync is ready."
      : "Individual billing is active. Cloud sync will switch on after the next successful refresh.";
  }

  if (returnStatus === "canceled") {
    return "Checkout was canceled. Prompt Dock is staying in local mode.";
  }

  if (returnStatus === "success") {
    return "Checkout completed, but billing is not active yet. Refresh again in a moment if Stripe is still processing.";
  }

  return "Billing status refreshed.";
}

function getTeamBillingNoticeMessage(
  returnStatus: "success" | "canceled" | "portal" | null,
  nextState: PopupLibraryState,
  workspace: PromptWorkspace
) {
  if (
    nextState.activeWorkspace.id === workspace.id &&
    nextState.activeWorkspace.kind === "team" &&
    nextState.activeWorkspace.access === "ready"
  ) {
    return `${workspace.label} billing is active. Shared library access is ready.`;
  }

  if (returnStatus === "canceled") {
    return `${workspace.label} checkout was canceled. Team billing is still required.`;
  }

  if (returnStatus === "success") {
    return `Checkout completed, but ${workspace.label} is not active yet. Refresh again in a moment if Stripe is still processing.`;
  }

  return `${workspace.label} billing status refreshed.`;
}

function getRefreshMessage(state: PopupLibraryState) {
  if (state.activeWorkspace.kind === "team") {
    return state.activeWorkspace.access === "ready"
      ? `${state.activeWorkspace.label} refreshed.`
      : state.activeWorkspace.accessNotice ?? "Team workspace status refreshed.";
  }

  return state.mode === "cloud" ? "Cloud library refreshed." : "Local library refreshed.";
}

function getWorkspaceSwitchMessage(state: PopupLibraryState) {
  if (state.activeWorkspace.kind === "team" && state.activeWorkspace.access !== "ready") {
    return state.activeWorkspace.accessNotice ?? `${state.activeWorkspace.label} is waiting on billing.`;
  }

  return state.activeWorkspace.kind === "team"
    ? `Switched to ${state.activeWorkspace.label}.`
    : state.mode === "cloud"
      ? "Switched to your synced personal library."
      : "Switched to your local personal library.";
}

function getPromptSaveMessage(state: PopupLibraryState, editingPromptId: string | null) {
  if (state.activeWorkspace.kind === "team") {
    return editingPromptId
      ? `Prompt updated in ${state.activeWorkspace.label}.`
      : `Prompt created in ${state.activeWorkspace.label}.`;
  }

  return state.mode === "cloud"
    ? editingPromptId
      ? "Prompt saved to cloud sync."
      : "Prompt created in cloud sync."
    : editingPromptId
      ? "Prompt updated locally."
      : "Prompt created locally.";
}

function getFolderCreateMessage(folderName: string, state: PopupLibraryState) {
  if (state.activeWorkspace.kind === "team") {
    return `Folder "${folderName}" created in ${state.activeWorkspace.label}.`;
  }

  return state.mode === "cloud" ? `Folder "${folderName}" created in cloud sync.` : `Folder "${folderName}" created.`;
}

function getPromptDeleteMessage(state: PopupLibraryState) {
  if (state.activeWorkspace.kind === "team") {
    return `Prompt deleted from ${state.activeWorkspace.label}.`;
  }

  return state.mode === "cloud" ? "Prompt deleted from cloud sync." : "Prompt deleted from local storage.";
}

function getPromptDuplicateMessage(title: string, state: PopupLibraryState) {
  if (state.activeWorkspace.kind === "team") {
    return `Duplicated "${title}" in ${state.activeWorkspace.label}.`;
  }

  return state.mode === "cloud" ? `Duplicated "${title}" in cloud sync.` : `Duplicated "${title}".`;
}

function getWorkspaceReadOnlyMessage(workspace: PromptWorkspace) {
  if (workspace.access !== "ready") {
    return workspace.accessNotice ?? "This workspace is not available yet.";
  }

  if (workspace.kind === "team") {
    return "Team members can use shared prompts, but only owners and admins can edit them.";
  }

  return "This workspace is read-only right now.";
}

function getWorkspaceDeleteTarget(workspace: PromptWorkspace, libraryMode: "local" | "cloud") {
  if (workspace.kind === "team") {
    return workspace.label;
  }

  return libraryMode === "cloud" ? "cloud sync" : "local storage";
}

function getWorkspaceBadgeLabel(workspace: PromptWorkspace, libraryMode: "local" | "cloud") {
  if (workspace.kind === "team") {
    return workspace.access === "ready" ? "Shared team library" : "Team billing required";
  }

  return libraryMode === "cloud" ? "Personal cloud sync" : "Free local mode";
}

function getWorkspaceBadgeClass(workspace: PromptWorkspace, libraryMode: "local" | "cloud") {
  if (workspace.kind === "team") {
    return workspace.access === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  }

  return libraryMode === "cloud"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-cyan-200 bg-cyan-50 text-cyan-700";
}

function hasBillingActivatedForScope(
  scope: "individual" | "team",
  workspaceId: string | null,
  state: PopupLibraryState
) {
  if (scope === "individual") {
    return state.billing.planKey === "individual" && isActiveSubscriptionStatus(state.billing.status);
  }

  return (
    Boolean(workspaceId) &&
    state.activeWorkspace.id === workspaceId &&
    state.activeWorkspace.kind === "team" &&
    state.activeWorkspace.access === "ready"
  );
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

async function copyInviteToClipboard(inviteUrl: string | null) {
  if (!inviteUrl) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(inviteUrl);
    return true;
  } catch {
    return false;
  }
}
