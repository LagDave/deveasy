-- Migration: create project_editor_state (PostgreSQL — the DevEasy target DB)
-- Persists the in-app code editor's open tabs + active tab, per project, so the
-- editor reopens where the operator left off. Unsaved buffer content is NOT stored.
-- One row per project (project_id UNIQUE), cascade-deleted with the project.
-- TODO: confirm exact column defaults during execution.

CREATE TABLE IF NOT EXISTS project_editor_state (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
  open_paths   JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- ordered array of relative file paths
  active_path  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_id UNIQUE already provides the lookup index.

-- Rollback:
-- DROP TABLE IF EXISTS project_editor_state;
