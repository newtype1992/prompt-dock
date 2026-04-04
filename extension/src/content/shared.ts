import { isInjectPromptMessage, type PromptDockInjectPromptResponse } from "../lib/messages";
import type { SiteKey } from "../lib/sites";

const siteSelectors: Record<SiteKey, string[]> = {
  chatgpt: ['#prompt-textarea', 'textarea', '[contenteditable="true"][data-lexical-editor="true"]', '[contenteditable="true"]'],
  claude: ['div[contenteditable="true"]', 'textarea', '[contenteditable="true"]'],
  gemini: ['div[contenteditable="true"]', 'textarea', '[contenteditable="true"]'],
  perplexity: ['textarea', 'div[contenteditable="true"]', '[contenteditable="true"]'],
};

export function bootSiteAdapter(site: SiteKey) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isInjectPromptMessage(message)) {
      return false;
    }

    sendResponse(injectPromptIntoPage(site, message.payload.promptText));
    return false;
  });

  const input = findEditableElement(site);
  console.info(`[Prompt Dock] ${site} adapter loaded. Input detected: ${Boolean(input)}`);
}

function injectPromptIntoPage(site: SiteKey, promptText: string): PromptDockInjectPromptResponse {
  const input = findEditableElement(site);

  if (!input) {
    return {
      ok: false,
      site,
      method: "none",
      reason: "No supported input was found on the current page.",
      fallbackSuggested: true,
    };
  }

  focusElement(input);

  if (isTextInput(input)) {
    setTextInputValue(input, promptText);
    return {
      ok: true,
      site,
      method: "dom",
    };
  }

  if (input.isContentEditable) {
    setContentEditableValue(input, promptText);
    return {
      ok: true,
      site,
      method: "dom",
    };
  }

  return {
    ok: false,
    site,
    method: "none",
    reason: "Prompt Dock found an element, but it was not writable.",
    fallbackSuggested: true,
  };
}

function findEditableElement(site: SiteKey) {
  const selectors = siteSelectors[site];

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const editableCandidate = candidates.find(isUsableEditableElement);

    if (editableCandidate) {
      return editableCandidate;
    }
  }

  return null;
}

function isUsableEditableElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const isVisible = style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;

  if (!isVisible) {
    return false;
  }

  if (isTextInput(element)) {
    return !element.disabled && !element.readOnly;
  }

  return element.isContentEditable;
}

function isTextInput(element: HTMLElement): element is HTMLTextAreaElement | HTMLInputElement {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}

function focusElement(element: HTMLElement) {
  element.focus();
  element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
}

function setTextInputValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as HTMLTextAreaElement | HTMLInputElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(element, value);

  element.setSelectionRange?.(value.length, value.length);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setContentEditableValue(element: HTMLElement, value: string) {
  const selection = window.getSelection();

  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  element.textContent = value;
  element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
