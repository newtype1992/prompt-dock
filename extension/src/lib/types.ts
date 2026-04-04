export type PromptFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type PromptRecord = {
  id: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalPromptLibrary = {
  version: 1;
  folders: PromptFolder[];
  prompts: PromptRecord[];
};

export type PromptDraft = {
  title: string;
  description: string;
  body: string;
  tagsInput: string;
  folderId: string | null;
};

