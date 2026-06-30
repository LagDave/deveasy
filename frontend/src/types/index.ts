/** Shared frontend types. Typed against the backend envelopes (Constitution §17.2). */

export interface Project {
  id: number;
  name: string;
  path: string;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Code-editor domain types — mirror the backend editor envelopes. */

export type FileKind = "text" | "image" | "pdf" | "html";

export interface FileTreeEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface FileContent {
  path: string;
  content: string;
  kind: FileKind;
}

export interface EditorState {
  openPaths: string[];
  activePath: string | null;
}

/** The file's content at git HEAD (null = new/untracked), for the editor diff gutter. */
export interface HeadContent {
  content: string | null;
}

/** How a path differs from HEAD, shared by the file-tree highlight and the gutter. */
export type ChangeKind = "added" | "modified" | "deleted";
