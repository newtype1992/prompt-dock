import type { SiteKey } from "../lib/sites";

export type SiteAdapterConfig = {
  avoidText: string[];
  containerSelectors: string[];
  preferredText: string[];
  selectors: string[];
};

export type EditableCandidateSnapshot = {
  ariaLabel: string | null;
  insidePreferredContainer: boolean;
  isContentEditable: boolean;
  isFocused: boolean;
  isTextInput: boolean;
  placeholder: string | null;
  role: string | null;
  selector: string;
  tagName: string;
};

export const SITE_ADAPTER_CONFIG: Record<SiteKey, SiteAdapterConfig> = {
  chatgpt: {
    avoidText: ["search", "find", "rename"],
    containerSelectors: ["form", "main", "[data-testid*='composer']"],
    preferredText: ["message chatgpt", "send a message", "prompt"],
    selectors: [
      "#prompt-textarea",
      "form textarea",
      "textarea[placeholder*='Message']",
      "[contenteditable='true'][data-lexical-editor='true']",
      "[contenteditable='true'][role='textbox']",
      "textarea",
      "[contenteditable='true']",
    ],
  },
  claude: {
    avoidText: ["search", "project name", "rename"],
    containerSelectors: ["form", "fieldset", "main"],
    preferredText: ["talk to claude", "message claude", "write your prompt", "ask claude"],
    selectors: [
      "form div[contenteditable='true'][role='textbox']",
      "fieldset div[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
  gemini: {
    avoidText: ["search", "filter", "rename"],
    containerSelectors: ["form", "rich-textarea", "main"],
    preferredText: ["enter a prompt", "message gemini", "ask gemini"],
    selectors: [
      "rich-textarea textarea",
      "rich-textarea [contenteditable='true']",
      "form [contenteditable='true'][role='textbox']",
      "textarea",
      "[contenteditable='true'][role='textbox']",
      "[contenteditable='true']",
    ],
  },
  perplexity: {
    avoidText: ["search", "filter", "rename"],
    containerSelectors: ["form", "footer", "main"],
    preferredText: ["ask anything", "ask follow-up", "what do you want to know", "message perplexity"],
    selectors: [
      "form textarea",
      "textarea[placeholder*='Ask']",
      "[contenteditable='true'][role='textbox']",
      "textarea",
      "[contenteditable='true']",
    ],
  },
};

export function getSiteAdapterConfig(site: SiteKey) {
  return SITE_ADAPTER_CONFIG[site];
}

export function rankSiteCandidate(
  site: SiteKey,
  candidate: EditableCandidateSnapshot,
  selectorIndex: number
) {
  const config = getSiteAdapterConfig(site);
  const signalText = [candidate.ariaLabel, candidate.placeholder, candidate.role, candidate.tagName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = Math.max(0, 48 - selectorIndex * 7);

  if (candidate.isFocused) {
    score += 40;
  }

  if (candidate.insidePreferredContainer) {
    score += 16;
  }

  if (candidate.isTextInput) {
    score += site === "chatgpt" || site === "perplexity" || site === "gemini" ? 10 : 4;
  }

  if (candidate.isContentEditable) {
    score += site === "claude" || site === "gemini" ? 10 : 4;
  }

  if (candidate.role === "textbox") {
    score += 6;
  }

  for (const phrase of config.preferredText) {
    if (signalText.includes(phrase)) {
      score += 12;
    }
  }

  for (const phrase of config.avoidText) {
    if (signalText.includes(phrase)) {
      score -= 28;
    }
  }

  return score;
}

export function sortEditableCandidates(site: SiteKey, candidates: EditableCandidateSnapshot[]) {
  return [...candidates].sort((left, right) => {
    const leftScore = rankSiteCandidate(site, left, getSelectorIndex(site, left.selector));
    const rightScore = rankSiteCandidate(site, right, getSelectorIndex(site, right.selector));

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return getSelectorIndex(site, left.selector) - getSelectorIndex(site, right.selector);
  });
}

function getSelectorIndex(site: SiteKey, selector: string) {
  const index = getSiteAdapterConfig(site).selectors.indexOf(selector);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
