/** Shared model-catalog types (Constitution §12.2 types/). */

export interface ClaudeModel {
  id: string;
  displayName: string;
  contextWindow: number | null;
  createdAt: string | null;
  /** Effort (thinking level) is selectable for this model. */
  effortSupported: boolean;
  /** The effort levels this model supports (subset of low/medium/high/xhigh/max). */
  efforts: string[];
}

export interface ModelCatalog {
  available: boolean;
  models: ClaudeModel[];
}
