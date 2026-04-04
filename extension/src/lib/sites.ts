export type SiteKey = "chatgpt" | "claude" | "gemini" | "perplexity";

export type SiteDefinition = {
  key: SiteKey;
  label: string;
  hosts: string[];
};

export const SITE_DEFINITIONS: SiteDefinition[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    hosts: ["chatgpt.com", "chat.openai.com"],
  },
  {
    key: "claude",
    label: "Claude",
    hosts: ["claude.ai"],
  },
  {
    key: "gemini",
    label: "Gemini",
    hosts: ["gemini.google.com"],
  },
  {
    key: "perplexity",
    label: "Perplexity",
    hosts: ["www.perplexity.ai", "perplexity.ai"],
  },
] as const;

export function getSiteDefinition(key: SiteKey) {
  return SITE_DEFINITIONS.find((site) => site.key === key) ?? null;
}

export function getSiteForUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname;
    return SITE_DEFINITIONS.find((site) => site.hosts.includes(hostname)) ?? null;
  } catch {
    return null;
  }
}

