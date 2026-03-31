type SiteKey = "chatgpt" | "claude" | "gemini" | "perplexity";

const siteSelectors: Record<SiteKey, string[]> = {
  chatgpt: ["textarea", '[contenteditable="true"]'],
  claude: ["textarea", '[contenteditable="true"]'],
  gemini: ["textarea", '[contenteditable="true"]'],
  perplexity: ["textarea", '[contenteditable="true"]'],
};

export function bootSiteAdapter(site: SiteKey) {
  const selectorList = siteSelectors[site];
  const input = selectorList
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((node): node is HTMLElement => Boolean(node));

  console.info(`[Prompt Dock] ${site} adapter loaded. Input detected: ${Boolean(input)}`);
}

