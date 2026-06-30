/**
 * Vitest global setup. Provides the minimum environment the app's config schema
 * (src/config) requires so importing modules that transitively load the logger /
 * config does not fail fast (§5.6) under test. No real DB connection is opened —
 * DB-dependent code is mocked in the tests that need it.
 */
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/deveasy_test";
process.env.LOG_LEVEL ??= "error";
