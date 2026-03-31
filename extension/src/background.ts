chrome.runtime.onInstalled.addListener(() => {
  console.info("[Prompt Dock] Extension scaffold installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PROMPT_DOCK_PING") {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  return false;
});

