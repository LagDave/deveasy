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
