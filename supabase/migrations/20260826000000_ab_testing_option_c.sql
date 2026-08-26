-- A/B Testing Option C (2026-08-26)
-- The experiment owns the shared trigger + distribution; variants are
-- trigger-less presentation workflows with a weight + on/off.
-- Idempotent: safe to run on an already-migrated database.

-- 1. Experiment trigger + distribution config (existing tables get ALTERs)
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS trigger_keywords  TEXT[];
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS trigger_algorithm TEXT NOT NULL DEFAULT 'dice';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS trigger_threshold REAL NOT NULL DEFAULT 75;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS session_id       BIGINT REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS distribution_mode TEXT NOT NULL DEFAULT 'balanced';

-- 2. Variant table: a variant IS a presentation workflow
CREATE TABLE IF NOT EXISTS experiment_variants (
  experiment_id BIGINT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  workflow_id   BIGINT NOT NULL REFERENCES workflows(id)  ON DELETE CASCADE,
  weight        REAL   NOT NULL DEFAULT 100,
  active        BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (experiment_id, workflow_id)
);
