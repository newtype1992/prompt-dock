void configureSidePanelBehavior();

chrome.runtime.onInstalled.addListener(() => {
  console.info("[Prompt Dock] Extension scaffold installed.");
  void configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanelBehavior();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PROMPT_DOCK_PING") {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  return false;
});

async function configureSidePanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    });
  } catch (error) {
    console.warn("[Prompt Dock] Unable to configure side panel behavior.", error);
  }
}
