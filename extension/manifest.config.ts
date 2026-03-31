import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Prompt Dock",
  version: "0.1.0",
  description: "Save, organize, and inject reusable prompts into AI tools.",
  permissions: ["activeTab", "clipboardWrite", "scripting", "storage", "tabs"],
  host_permissions: [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
  ],
  action: {
    default_title: "Prompt Dock",
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://chatgpt.com/*"],
      js: ["src/content/chatgpt.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://claude.ai/*"],
      js: ["src/content/claude.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://gemini.google.com/*"],
      js: ["src/content/gemini.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://www.perplexity.ai/*"],
      js: ["src/content/perplexity.ts"],
      run_at: "document_idle",
    },
  ],
});

