import type { SiteKey } from "./sites";

export const PROMPT_DOCK_INJECT_PROMPT = "PROMPT_DOCK_INJECT_PROMPT";

export type PromptDockInjectPromptMessage = {
  type: typeof PROMPT_DOCK_INJECT_PROMPT;
  payload: {
    promptText: string;
  };
};

export type PromptDockInjectPromptResponse = {
  ok: boolean;
  site: SiteKey;
  method: "dom" | "none";
  reason?: string;
  fallbackSuggested?: boolean;
};

export function createInjectPromptMessage(promptText: string): PromptDockInjectPromptMessage {
  return {
    type: PROMPT_DOCK_INJECT_PROMPT,
    payload: {
      promptText,
    },
  };
}

export function isInjectPromptMessage(message: unknown): message is PromptDockInjectPromptMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === PROMPT_DOCK_INJECT_PROMPT &&
    "payload" in message &&
    typeof message.payload === "object" &&
    message.payload !== null &&
    "promptText" in message.payload &&
    typeof message.payload.promptText === "string"
  );
}

