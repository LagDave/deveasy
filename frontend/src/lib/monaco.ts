import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { emmetHTML, emmetCSS, emmetJSX } from "emmet-monaco-es";

/**
 * Self-host Monaco's web workers so the editor works fully offline — DevEasy is
 * local-first and must never reach a CDN for editor assets (§4.4). Workers are
 * bundled by Vite via the `?worker` imports above.
 */

let initialized = false;

/** Runs the Monaco worker + Emmet + loader setup exactly once. */
export function ensureMonacoSetup(): void {
  if (initialized) return;
  initialized = true;

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      switch (label) {
        case "json":
          return new jsonWorker();
        case "css":
        case "scss":
        case "less":
          return new cssWorker();
        case "html":
        case "handlebars":
        case "razor":
          return new htmlWorker();
        case "typescript":
        case "javascript":
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };

  // Emmet expansion for HTML / CSS / JSX.
  emmetHTML(monaco);
  emmetCSS(monaco);
  emmetJSX(monaco);

  // Bind @monaco-editor/react to this bundled monaco instance (no CDN download).
  loader.config({ monaco });
}
