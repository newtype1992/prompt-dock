import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankSiteCandidate, sortEditableCandidates, type EditableCandidateSnapshot } from "../../extension/src/content/adapter-config";

describe("site adapter ranking", () => {
  it("prefers the active ChatGPT composer over a generic contenteditable", () => {
    const candidates = sortEditableCandidates("chatgpt", [
      createCandidate({
        isContentEditable: true,
        selector: "[contenteditable='true']",
      }),
      createCandidate({
        isFocused: true,
        isTextInput: true,
        placeholder: "Message ChatGPT",
        selector: "#prompt-textarea",
        tagName: "TEXTAREA",
      }),
    ]);

    assert.equal(candidates[0]?.selector, "#prompt-textarea");
  });

  it("deprioritizes search-like Gemini fields", () => {
    const promptScore = rankSiteCandidate(
      "gemini",
      createCandidate({
        ariaLabel: "Enter a prompt here",
        insidePreferredContainer: true,
        isContentEditable: true,
        role: "textbox",
        selector: "rich-textarea [contenteditable='true']",
      }),
      1
    );
    const searchScore = rankSiteCandidate(
      "gemini",
      createCandidate({
        ariaLabel: "Search",
        isContentEditable: true,
        role: "textbox",
        selector: "[contenteditable='true'][role='textbox']",
      }),
      4
    );

    assert.ok(promptScore > searchScore);
  });

  it("prefers Claude editors inside the main composer container", () => {
    const candidates = sortEditableCandidates("claude", [
      createCandidate({
        isContentEditable: true,
        role: "textbox",
        selector: "div[contenteditable='true'][role='textbox']",
      }),
      createCandidate({
        insidePreferredContainer: true,
        isContentEditable: true,
        role: "textbox",
        selector: "form div[contenteditable='true'][role='textbox']",
      }),
    ]);

    assert.equal(candidates[0]?.selector, "form div[contenteditable='true'][role='textbox']");
  });

  it("prefers Perplexity ask fields over generic textarea matches", () => {
    const candidates = sortEditableCandidates("perplexity", [
      createCandidate({
        isTextInput: true,
        placeholder: "Search",
        selector: "textarea",
        tagName: "TEXTAREA",
      }),
      createCandidate({
        insidePreferredContainer: true,
        isTextInput: true,
        placeholder: "Ask anything",
        selector: "textarea[placeholder*='Ask']",
        tagName: "TEXTAREA",
      }),
    ]);

    assert.equal(candidates[0]?.selector, "textarea[placeholder*='Ask']");
  });
});

function createCandidate(overrides: Partial<EditableCandidateSnapshot>): EditableCandidateSnapshot {
  return {
    ariaLabel: overrides.ariaLabel ?? null,
    insidePreferredContainer: overrides.insidePreferredContainer ?? false,
    isContentEditable: overrides.isContentEditable ?? false,
    isFocused: overrides.isFocused ?? false,
    isTextInput: overrides.isTextInput ?? false,
    placeholder: overrides.placeholder ?? null,
    role: overrides.role ?? null,
    selector: overrides.selector ?? "textarea",
    tagName: overrides.tagName ?? "DIV",
  };
}
