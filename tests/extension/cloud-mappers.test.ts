import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapRemoteLibraryRowsToLocalLibrary, shouldImportLocalLibrary } from "../../extension/src/lib/cloud-mappers";
import type { LocalPromptLibrary } from "../../extension/src/lib/types";

describe("cloud library mappers", () => {
  it("maps remote folders and prompts into the popup library shape", () => {
    const library = mapRemoteLibraryRowsToLocalLibrary(
      [
        {
          created_at: "2026-04-05T10:00:00.000Z",
          id: "folder-b",
          name: "Writing",
          position: 1,
        },
        {
          created_at: "2026-04-05T09:00:00.000Z",
          id: "folder-a",
          name: "Research",
          position: 0,
        },
      ],
      [
        {
          body: "Prompt body",
          created_at: "2026-04-05T11:00:00.000Z",
          description: "Prompt description",
          folder_id: "folder-a",
          id: "prompt-a",
          tags: ["research", " ", "analysis"],
          title: "Research Brief",
          updated_at: "2026-04-05T12:00:00.000Z",
        },
      ]
    );

    assert.deepEqual(library, {
      version: 1,
      folders: [
        {
          createdAt: "2026-04-05T09:00:00.000Z",
          id: "folder-a",
          name: "Research",
        },
        {
          createdAt: "2026-04-05T10:00:00.000Z",
          id: "folder-b",
          name: "Writing",
        },
      ],
      prompts: [
        {
          body: "Prompt body",
          createdAt: "2026-04-05T11:00:00.000Z",
          description: "Prompt description",
          folderId: "folder-a",
          id: "prompt-a",
          tags: ["research", "analysis"],
          title: "Research Brief",
          updatedAt: "2026-04-05T12:00:00.000Z",
        },
      ],
    });
  });

  it("imports local content only when the remote library is empty", () => {
    const localLibrary: LocalPromptLibrary = {
      version: 1,
      folders: [
        {
          createdAt: "2026-04-05T10:00:00.000Z",
          id: "folder-a",
          name: "Research",
        },
      ],
      prompts: [],
    };

    const emptyRemote: LocalPromptLibrary = {
      version: 1,
      folders: [],
      prompts: [],
    };

    const nonEmptyRemote: LocalPromptLibrary = {
      version: 1,
      folders: [],
      prompts: [
        {
          body: "Prompt body",
          createdAt: "2026-04-05T11:00:00.000Z",
          description: "",
          folderId: null,
          id: "prompt-a",
          tags: [],
          title: "Prompt",
          updatedAt: "2026-04-05T11:00:00.000Z",
        },
      ],
    };

    assert.equal(shouldImportLocalLibrary(localLibrary, emptyRemote), true);
    assert.equal(shouldImportLocalLibrary(localLibrary, nonEmptyRemote), false);
  });
});
