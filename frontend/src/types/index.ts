/** Shared frontend types. Typed against the backend envelopes (Constitution §17.2). */

export interface Project {
  id: number;
  name: string;
  path: string;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}
