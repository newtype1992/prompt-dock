import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPromptDragPayload, hasPromptDragType, parsePromptDragPayload, PROMPT_DOCK_DRAG_MIME } from "../../extension/src/lib/drag";

describe("prompt drag helpers", () => {
  it("serializes and parses a prompt drag payload", () => {
    const serialized = createPromptDragPayload({
      promptText: "Write a launch email",
      title: "Launch email",
    });

    assert.deepEqual(parsePromptDragPayload(serialized), {
      promptText: "Write a launch email",
      title: "Launch email",
    });
  });

  it("rejects malformed payloads", () => {
    assert.equal(parsePromptDragPayload(""), null);
    assert.equal(parsePromptDragPayload("{"), null);
    assert.equal(parsePromptDragPayload(JSON.stringify({ title: "Missing text" })), null);
  });

  it("detects the Prompt Dock drag mime type", () => {
    assert.equal(hasPromptDragType(["text/plain", PROMPT_DOCK_DRAG_MIME]), true);
    assert.equal(hasPromptDragType(["text/plain"]), false);
  });
});
