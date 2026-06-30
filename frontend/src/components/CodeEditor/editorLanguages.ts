import type { FileKind } from "../../types";

/**
 * Pure mapping helpers for the editor: file extension → Monaco language id, and
 * extension → viewer kind. `kindForPath` mirrors the backend `classifyFile`
 * (src/controllers/editor/feature-utils/fileSafety.ts) so the UI and server
 * agree on what is text vs image/pdf/html.
 */

/** Lowercase extension without the leading dot, or "" when there is none. */
function extensionOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Extension (no dot, lowercase) → Monaco language id. Unmapped falls back to plaintext. */
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  json: "json",
  jsonc: "json",
  json5: "json",
  xml: "xml",
  svg: "xml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  toml: "ini",
  ini: "ini",
  env: "ini",
  dockerfile: "dockerfile",
  graphql: "graphql",
  gql: "graphql",
};

/** Monaco language id for a path's extension (e.g. `ts` → `typescript`). */
export function languageForPath(path: string): string {
  return LANGUAGE_BY_EXTENSION[extensionOf(path)] ?? "plaintext";
}

/** Extension → viewer kind. Mirror of the backend `classifyFile` (§4.2). */
const KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  bmp: "image",
  ico: "image",
  pdf: "pdf",
  html: "html",
  htm: "html",
};

/** Classify a path by extension into the four viewer kinds; unmapped is text. */
export function kindForPath(path: string): FileKind {
  return KIND_BY_EXTENSION[extensionOf(path)] ?? "text";
}
