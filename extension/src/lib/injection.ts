import { createInjectPromptMessage, type PromptDockInjectPromptResponse } from "./messages";
import { getSiteForUrl } from "./sites";

export type InjectionResult =
  | {
      status: "inserted";
      message: string;
    }
  | {
      status: "clipboard";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export async function injectPromptFromPopup(promptText: string): Promise<InjectionResult> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return copyPromptToClipboard(promptText, "Prompt copied to your clipboard because no active tab was available.");
  }

  const activeSite = getSiteForUrl(activeTab.url);

  if (!activeSite) {
    return copyPromptToClipboard(
      promptText,
      "Prompt copied to your clipboard. Open ChatGPT, Claude, Gemini, or Perplexity for direct insertion."
    );
  }

  try {
    const response = (await chrome.tabs.sendMessage(
      activeTab.id,
      createInjectPromptMessage(promptText)
    )) as PromptDockInjectPromptResponse | undefined;

    if (response?.ok && response.method === "dom") {
      return {
        status: "inserted",
        message: `Prompt inserted directly into ${activeSite.label}.`,
      };
    }

    return copyPromptToClipboard(
      promptText,
      response?.reason
        ? `${response.reason} Prompt copied to your clipboard instead.`
        : `Prompt copied to your clipboard because direct insertion was unavailable on ${activeSite.label}.`
    );
  } catch {
    return copyPromptToClipboard(
      promptText,
      `Prompt copied to your clipboard because ${activeSite.label} did not respond to the extension.`
    );
  }
}

export async function getActiveSiteSummary() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const activeSite = getSiteForUrl(activeTab?.url);

  if (!activeTab?.id) {
    return {
      label: "No active tab",
      supported: false,
    };
  }

  if (!activeSite) {
    return {
      label: "Unsupported tab",
      supported: false,
    };
  }

  return {
    label: activeSite.label,
    supported: true,
  };
}

async function copyPromptToClipboard(promptText: string, message: string): Promise<InjectionResult> {
  try {
    await navigator.clipboard.writeText(promptText);
    return {
      status: "clipboard",
      message,
    };
  } catch {
    return {
      status: "error",
      message: "Direct insertion failed and the clipboard fallback was not available.",
    };
  }
}
