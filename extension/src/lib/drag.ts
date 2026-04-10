export const PROMPT_DOCK_DRAG_MIME = "application/x-prompt-dock-prompt";

export type PromptDockDragPayload = {
  promptText: string;
  title: string;
};

export function createPromptDragPayload({
  promptText,
  title,
}: {
  promptText: string;
  title: string;
}) {
  return JSON.stringify({
    promptText,
    title,
  } satisfies PromptDockDragPayload);
}

export function parsePromptDragPayload(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const payload = JSON.parse(value) as Partial<PromptDockDragPayload>;

    if (typeof payload.promptText !== "string" || !payload.promptText.trim()) {
      return null;
    }

    return {
      promptText: payload.promptText,
      title: typeof payload.title === "string" ? payload.title : "Prompt",
    } satisfies PromptDockDragPayload;
  } catch {
    return null;
  }
}

export function hasPromptDragType(types: ArrayLike<string> | readonly string[]) {
  return Array.from(types).includes(PROMPT_DOCK_DRAG_MIME);
}
