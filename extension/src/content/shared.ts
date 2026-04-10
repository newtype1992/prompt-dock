import { hasPromptDragType, parsePromptDragPayload, PROMPT_DOCK_DRAG_MIME } from "../lib/drag";
import { isInjectPromptMessage, type PromptDockInjectPromptResponse } from "../lib/messages";
import type { SiteKey } from "../lib/sites";
import type { EditableCandidateSnapshot } from "./adapter-config";
import { getSiteAdapterConfig, rankSiteCandidate } from "./adapter-config";

export function bootSiteAdapter(site: SiteKey) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isInjectPromptMessage(message)) {
      return false;
    }

    void injectPromptIntoPage(site, message.payload.promptText).then(sendResponse);
    return true;
  });
  document.addEventListener("dragover", (event) => handlePromptDragOver(site, event), true);
  document.addEventListener("drop", (event) => {
    void handlePromptDrop(site, event);
  }, true);

  const input = findEditableElement(site);
  console.info(`[Prompt Dock] ${site} adapter loaded. Input detected: ${Boolean(input)}.`);
}

async function injectPromptIntoPage(site: SiteKey, promptText: string): Promise<PromptDockInjectPromptResponse> {
  let lastFailureReason: string | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidates = findEditableElements(site);

    if (!candidates.length) {
      await wait(140);
      continue;
    }

    for (const input of candidates.slice(0, 4)) {
      try {
        focusElement(input);
      } catch {
        // Continue to another candidate when focus is blocked.
      }

      const inserted = await applyPromptToElement(input, promptText, "replace");

      if (inserted) {
        return {
          ok: true,
          site,
          method: "dom",
        };
      }

      lastFailureReason = "Prompt Dock found an input, but the site did not accept the inserted text.";
    }

    await wait(140);
  }

  return {
    ok: false,
    site,
    method: "none",
    reason: lastFailureReason ?? "No supported input was found on the current page.",
    fallbackSuggested: true,
  };
}

function handlePromptDragOver(site: SiteKey, event: DragEvent) {
  if (!isPromptDragEvent(event)) {
    return;
  }

  const target = resolveDropEditableTarget(site, event);

  if (!target) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

async function handlePromptDrop(site: SiteKey, event: DragEvent) {
  if (!isPromptDragEvent(event)) {
    return;
  }

  const promptText = getDraggedPromptText(event.dataTransfer);

  if (!promptText) {
    return;
  }

  const target = resolveDropEditableTarget(site, event);

  if (!target) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  try {
    focusElement(target);
  } catch {
    // The drop target might reject focus, but insertion can still succeed.
  }

  await applyPromptToElement(target, promptText, "insert");
}

function findEditableElement(site: SiteKey) {
  return findEditableElements(site)[0] ?? null;
}

function findEditableElements(site: SiteKey) {
  const config = getSiteAdapterConfig(site);
  const candidates: Array<{
    element: HTMLElement;
    score: number;
    snapshot: EditableCandidateSnapshot;
  }> = [];
  const seen = new Set<HTMLElement>();
  const activeElement = getActiveEditableElement();

  if (activeElement && isUsableEditableElement(activeElement)) {
    addCandidate(activeElement);
  }

  for (const searchRoot of getSearchRoots(document)) {
    for (const selector of config.selectors) {
      const matches = Array.from(searchRoot.querySelectorAll<HTMLElement>(selector));

      for (const match of matches) {
        if (!isUsableEditableElement(match)) {
          continue;
        }

        addCandidate(match);
      }
    }
  }

  return candidates
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return getSelectorIndex(site, left.snapshot.selector) - getSelectorIndex(site, right.snapshot.selector);
    })
    .map((candidate) => candidate.element);

  function addCandidate(element: HTMLElement) {
    if (seen.has(element)) {
      return;
    }

    seen.add(element);
    const selector = resolveSelector(site, element);
    const snapshot = buildCandidateSnapshot(site, element, selector);
    const selectorIndex = getSelectorIndex(site, selector);

    candidates.push({
      element,
      score: rankSiteCandidate(site, snapshot, selectorIndex),
      snapshot,
    });
  }
}

function buildCandidateSnapshot(site: SiteKey, element: HTMLElement, selector: string) {
  const config = getSiteAdapterConfig(site);
  const containerSelector = config.containerSelectors.join(", ");

  return {
    ariaLabel: element.getAttribute("aria-label"),
    insidePreferredContainer: Boolean(containerSelector && element.closest(containerSelector)),
    isContentEditable: element.isContentEditable,
    isFocused: document.activeElement === element,
    isTextInput: isTextInput(element),
    placeholder: getElementPlaceholder(element),
    role: element.getAttribute("role"),
    selector,
    tagName: element.tagName,
  };
}

function resolveSelector(site: SiteKey, element: HTMLElement) {
  const config = getSiteAdapterConfig(site);

  for (const selector of config.selectors) {
    if (element.matches(selector)) {
      return selector;
    }
  }

  return config.selectors[config.selectors.length - 1] ?? "[contenteditable='true']";
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
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      ["email", "number", "search", "tel", "text", "url"].includes(element.type || "text"))
  );
}

function focusElement(element: HTMLElement) {
  element.click?.();
  element.focus();
  element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
}

async function applyPromptToElement(
  element: HTMLElement,
  promptText: string,
  mode: "insert" | "replace"
) {
  if (isTextInput(element)) {
    return mode === "insert" ? insertTextInputValue(element, promptText) : setTextInputValue(element, promptText);
  }

  if (element.isContentEditable) {
    return mode === "insert" ? insertContentEditableValue(element, promptText) : setContentEditableValue(element, promptText);
  }

  return false;
}

async function setTextInputValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const setter = getValueSetter(element);

  setter?.call(element, value);

  element.setSelectionRange?.(value.length, value.length);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  await wait(24);
  return normalizeEditableValue(element.value) === normalizeEditableValue(value);
}

async function insertTextInputValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const setter = getValueSetter(element);
  const currentValue = element.value ?? "";
  const selectionStart = element.selectionStart ?? currentValue.length;
  const selectionEnd = element.selectionEnd ?? currentValue.length;
  const nextValue = `${currentValue.slice(0, selectionStart)}${value}${currentValue.slice(selectionEnd)}`;

  setter?.call(element, nextValue);
  const nextCaret = selectionStart + value.length;

  element.setSelectionRange?.(nextCaret, nextCaret);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertFromDrop" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  await wait(24);
  return normalizeEditableValue(element.value) === normalizeEditableValue(nextValue);
}

async function setContentEditableValue(element: HTMLElement, value: string) {
  const selection = window.getSelection();

  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: value, inputType: "insertText" }));

  if (!tryExecCommandInsert(value, { replaceAll: true })) {
    replaceContentEditableContents(element, value);
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  placeCaretAtEnd(element);

  await wait(24);
  return normalizeEditableValue(readContentEditableValue(element)) === normalizeEditableValue(value);
}

async function insertContentEditableValue(element: HTMLElement, value: string) {
  const beforeValue = normalizeEditableValue(readContentEditableValue(element));
  ensureSelectionInsideElement(element);
  element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: value, inputType: "insertFromDrop" }));

  if (!tryExecCommandInsert(value)) {
    insertFragmentAtSelection(element, value);
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertFromDrop" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  placeCaretAtEnd(element);

  await wait(24);

  const afterValue = normalizeEditableValue(readContentEditableValue(element));
  return afterValue.includes(normalizeEditableValue(value)) && afterValue.length >= beforeValue.length;
}

function getSearchRoots(root: Document | ShadowRoot) {
  const roots: Array<Document | ShadowRoot> = [root];
  const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));

  for (const element of elements) {
    if (element.shadowRoot) {
      roots.push(...getSearchRoots(element.shadowRoot));
    }
  }

  return roots;
}

function getActiveEditableElement() {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function resolveDropEditableTarget(site: SiteKey, event: DragEvent) {
  const composedPath = event.composedPath();

  for (const item of composedPath) {
    if (!(item instanceof HTMLElement)) {
      continue;
    }

    if (isUsableEditableElement(item)) {
      return item;
    }

    const ancestor = item.closest("textarea, input, [contenteditable='true'], [role='textbox']");

    if (ancestor instanceof HTMLElement && isUsableEditableElement(ancestor)) {
      return ancestor;
    }
  }

  const activeElement = getActiveEditableElement();

  if (activeElement && isUsableEditableElement(activeElement)) {
    return activeElement;
  }

  return findEditableElement(site);
}

function getElementPlaceholder(element: HTMLElement) {
  if (isTextInput(element)) {
    return element.placeholder || null;
  }

  return element.getAttribute("data-placeholder") ?? element.getAttribute("placeholder");
}

function getValueSetter(element: HTMLTextAreaElement | HTMLInputElement) {
  let prototype = Object.getPrototypeOf(element);

  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      return descriptor.set;
    }

    prototype = Object.getPrototypeOf(prototype);
  }

  return null;
}

function tryExecCommandInsert(
  value: string,
  options?: {
    replaceAll?: boolean;
  }
) {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  try {
    if (options?.replaceAll) {
      document.execCommand("selectAll", false);
    }

    return document.execCommand("insertText", false, value);
  } catch {
    return false;
  }
}

function replaceContentEditableContents(element: HTMLElement, value: string) {
  const fragment = document.createDocumentFragment();
  const lines = value.split("\n");

  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      fragment.appendChild(document.createElement("br"));
    }

    fragment.appendChild(document.createTextNode(line));
  }

  element.replaceChildren(fragment);
}

function insertFragmentAtSelection(element: HTMLElement, value: string) {
  ensureSelectionInsideElement(element);

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    replaceContentEditableContents(element, value);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = createContentEditableFragment(value);

  range.insertNode(fragment);
  selection.removeAllRanges();
  placeCaretAtEnd(element);
}

function readContentEditableValue(element: HTMLElement) {
  return element.innerText || element.textContent || "";
}

function ensureSelectionInsideElement(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    placeCaretAtEnd(element);
    return;
  }

  const range = selection.getRangeAt(0);

  if (!element.contains(range.commonAncestorContainer)) {
    placeCaretAtEnd(element);
  }
}

function createContentEditableFragment(value: string) {
  const fragment = document.createDocumentFragment();
  const lines = value.split("\n");

  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      fragment.appendChild(document.createElement("br"));
    }

    fragment.appendChild(document.createTextNode(line));
  }

  return fragment;
}

function placeCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.addRange(range);
}

function normalizeEditableValue(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\u200b", "").trim();
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function isPromptDragEvent(event: DragEvent) {
  return Boolean(event.dataTransfer && hasPromptDragType(event.dataTransfer.types));
}

function getDraggedPromptText(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return null;
  }

  const payload = parsePromptDragPayload(dataTransfer.getData(PROMPT_DOCK_DRAG_MIME));

  if (payload?.promptText) {
    return payload.promptText;
  }

  const fallbackText = dataTransfer.getData("text/plain");
  return fallbackText.trim() ? fallbackText : null;
}

function getSelectorIndex(site: SiteKey, selector: string) {
  const index = getSiteAdapterConfig(site).selectors.indexOf(selector);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
