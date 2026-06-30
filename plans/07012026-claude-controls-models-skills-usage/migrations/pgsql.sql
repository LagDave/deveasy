-- Plan 07012026 — Claude Controls (PostgreSQL reference DDL)
-- DevEasy is Postgres-only; the executed change is the TS Knex migration
-- (knexmigration.ts → src/database/migrations/0005_session_model.ts).
-- This file documents the equivalent raw SQL. No mssql.sql: SQL Server is N/A.

ALTER TABLE sessions
  ADD COLUMN model VARCHAR(255) NULL,            -- CLI model alias/full name; null = CLI default
  ADD COLUMN cli_session_id VARCHAR(255) NULL;   -- CLI session uuid (init event) for --resume

-- Rollback:
-- ALTER TABLE sessions DROP COLUMN cli_session_id;
-- ALTER TABLE sessions DROP COLUMN model;
