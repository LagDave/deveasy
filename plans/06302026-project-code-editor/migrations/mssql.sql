-- Migration: create project_editor_state (Microsoft SQL Server)
--
-- NOTE: DevEasy targets PostgreSQL only (pg + Knex). This file is included for
-- plan-template completeness; it is NOT applied by this project. The authoritative
-- migration is knexmigration.js / pgsql.sql.
-- TODO: only fill/use if DevEasy ever adds an MSSQL target.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'project_editor_state')
BEGIN
  CREATE TABLE project_editor_state (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    project_id   INT NOT NULL UNIQUE
                   FOREIGN KEY REFERENCES projects (id) ON DELETE CASCADE,
    open_paths   NVARCHAR(MAX) NOT NULL DEFAULT '[]',  -- JSON array of relative paths
    active_path  NVARCHAR(MAX) NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

-- Rollback:
-- DROP TABLE IF EXISTS project_editor_state;
