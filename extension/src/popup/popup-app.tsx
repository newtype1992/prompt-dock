import { useCallback, useEffect, useRef, useState } from "react";
import { PRODUCT_NAME } from "@/lib/product/config";
import {
  createFolderForCurrentMode,
  deletePromptForCurrentMode,
  duplicatePromptForCurrentMode,
  loadPopupLibraryState,
  refreshCloudLibrary,
  savePromptForCurrentMode,
  signInWithPassword,
  signOutFromCloud,
  signUpWithPassword,
  type PopupLibraryState,
} from "../lib/cloud-sync";
import { getActiveSiteSummary, injectPromptFromPopup } from "../lib/injection";
import { createEmptyPromptDraft, draftFromPrompt } from "../lib/storage";
import type { LocalPromptLibrary, PromptDraft, PromptRecord } from "../lib/types";
import { NoticeBanner, PageNavButton, type PopupNotice } from "./components";
import { AccountPage } from "./pages/account-page";
import { EditorPage } from "./pages/editor-page";
import { LibraryPage } from "./pages/library-page";

type DockPage = "library" | "editor" | "account";

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
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [libraryMode, setLibraryMode] = useState<"local" | "cloud">("local");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authIntent, setAuthIntent] = useState<"signIn" | "signUp">("signIn");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
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
    setCloudConfigured(nextState.cloudConfigured);
    setLibraryMode(nextState.mode);
    setLastSyncedAt(nextState.lastSyncedAt);
    setAccountEmail(nextState.account?.email ?? null);

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

  const loadPopupData = useCallback(async (preferredPromptId?: string | null) => {
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
  }, [applyPopupLibraryState]);

  useEffect(() => {
    void loadPopupData();
  }, [loadPopupData]);

  function selectPrompt(prompt: PromptRecord) {
    setEditingPromptId(prompt.id);
    setDraft(draftFromPrompt(prompt));
    navigateToPage("editor", setPage);
  }

  function beginCreatePrompt() {
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
      const nextState = await refreshCloudLibrary();
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message: nextState.mode === "cloud" ? "Cloud library refreshed." : "Local library refreshed.",
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

    try {
      const result = await savePromptForCurrentMode({
        currentLibrary: library,
        draft,
        editingPromptId,
      });

      applyPopupLibraryState(result.state, result.promptId);
      setNotice({
        tone: "success",
        message:
          result.state.mode === "cloud"
            ? editingPromptId
              ? "Prompt saved to cloud sync."
              : "Prompt created in cloud sync."
            : editingPromptId
              ? "Prompt updated locally."
              : "Prompt created locally.",
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
      const result = await createFolderForCurrentMode(folderName, library);
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
        message:
          result.state.mode === "cloud" ? `Folder "${folderName}" created in cloud sync.` : `Folder "${folderName}" created.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The folder could not be created.",
      });
    }
  }

  async function handleDeletePrompt(promptId: string) {
    if (!library) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    if (!window.confirm(`Delete "${prompt.title}" from ${libraryMode === "cloud" ? "cloud sync" : "local storage"}?`)) {
      return;
    }

    try {
      const nextState = await deletePromptForCurrentMode(promptId, library);
      applyPopupLibraryState(nextState);
      setNotice({
        tone: "success",
        message: nextState.mode === "cloud" ? "Prompt deleted from cloud sync." : "Prompt deleted from local storage.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The prompt could not be deleted.",
      });
    }
  }

  async function handleDuplicatePrompt(promptId: string) {
    if (!library) {
      return;
    }

    const prompt = library.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return;
    }

    try {
      const result = await duplicatePromptForCurrentMode(prompt, library);
      applyPopupLibraryState(result.state, result.promptId);
      setNotice({
        tone: "success",
        message:
          result.state.mode === "cloud" ? `Duplicated "${prompt.title}" in cloud sync.` : `Duplicated "${prompt.title}".`,
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

  if (isLoading || !library) {
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
                libraryMode === "cloud"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-cyan-200 bg-cyan-50 text-cyan-700"
              }`}
            >
              {libraryMode === "cloud" ? "Personal cloud sync" : "Free local mode"}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Prompt Dock now uses page-based navigation inside the extension side panel.
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
          description={editingPromptId ? "Active draft" : "Create prompt"}
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
          injectingPromptId={injectingPromptId}
          library={library}
          libraryMode={libraryMode}
          newFolderName={newFolderName}
          searchTerm={searchTerm}
          selectedPromptId={editingPromptId}
          visiblePrompts={visiblePrompts}
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
        />
      ) : null}

      {page === "editor" ? (
        <EditorPage
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
          authEmail={authEmail}
          authIntent={authIntent}
          authPassword={authPassword}
          cloudConfigured={cloudConfigured}
          isAuthSubmitting={isAuthSubmitting}
          isRefreshingCloud={isRefreshingCloud}
          lastSyncedAt={lastSyncedAt}
          libraryMode={libraryMode}
          onChangeAuthEmail={setAuthEmail}
          onChangeAuthIntent={setAuthIntent}
          onChangeAuthPassword={setAuthPassword}
          onRefreshCloud={() => void handleRefreshCloud()}
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
