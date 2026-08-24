-- WaStat V1 schema — see docs/adr/0001-sqlite-schema.md for decisions.
-- Timestamps: ISO-8601 UTC TEXT. JSON columns: TEXT containing JSON.

CREATE TABLE IF NOT EXISTS sessions (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  provider_session_id TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'disconnected',
  api_key_encrypted   BLOB,
  webhook_secret      TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id               INTEGER PRIMARY KEY,
  phone            TEXT NOT NULL UNIQUE,
  name             TEXT,
  funnel_phase     TEXT NOT NULL DEFAULT 'unassigned',
  bot_status       TEXT NOT NULL DEFAULT 'active',
  bot_paused_until TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS contact_attributes (
  id          INTEGER PRIMARY KEY,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(contact_id, key)
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (contact_id, tag)
);

CREATE TABLE IF NOT EXISTS private_notes (
  id          INTEGER PRIMARY KEY,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author      TEXT NOT NULL DEFAULT 'operator',
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS funnel_transitions (
  id              INTEGER PRIMARY KEY,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_phase      TEXT NOT NULL,
  to_phase        TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  operator_notes  TEXT,
  transitioned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id         INTEGER PRIMARY KEY,
  filename   TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size       INTEGER NOT NULL,
  r2_key     TEXT NOT NULL UNIQUE,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS experiments (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A variant IS a workflow (PRD 29): workflows.experiment_id links them.
CREATE TABLE IF NOT EXISTS workflows (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  active        INTEGER NOT NULL DEFAULT 0,
  experiment_id INTEGER REFERENCES experiments(id),
  ai_enabled    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id          INTEGER PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_key    TEXT NOT NULL,
  type        TEXT NOT NULL,
  config      TEXT NOT NULL DEFAULT '{}',
  position_x  REAL NOT NULL DEFAULT 0,
  position_y  REAL NOT NULL DEFAULT 0,
  UNIQUE (workflow_id, node_key)
);

CREATE TABLE IF NOT EXISTS workflow_edges (
  id          INTEGER PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_key  TEXT NOT NULL,
  target_key  TEXT NOT NULL,
  handle      TEXT,
  UNIQUE (workflow_id, source_key, target_key, handle)
);

-- Sticky assignment: a contact always lands in the same variant.
CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id INTEGER NOT NULL REFERENCES experiments(id),
  contact_id    INTEGER NOT NULL REFERENCES contacts(id),
  workflow_id   INTEGER NOT NULL REFERENCES workflows(id),
  assigned_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (experiment_id, contact_id)
);

-- One table for incoming + outgoing. Outgoing-only attribution columns are
-- nullable; this is what makes reply attribution possible (PRD 28).
CREATE TABLE IF NOT EXISTS messages (
  id                    INTEGER PRIMARY KEY,
  session_id            INTEGER NOT NULL REFERENCES sessions(id),
  contact_id            INTEGER NOT NULL REFERENCES contacts(id),
  direction             TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  message_type          TEXT NOT NULL,
  text                  TEXT,
  media_id              INTEGER REFERENCES media_assets(id),
  provider_message_id   TEXT UNIQUE,
  in_reply_to_id        INTEGER REFERENCES messages(id),
  workflow_execution_id INTEGER REFERENCES workflow_executions(id),
  node_key              TEXT,
  status                TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  timestamp             TEXT NOT NULL,
  raw_event             TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (session_id, contact_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_execution    ON messages (workflow_execution_id);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id                 INTEGER PRIMARY KEY,
  workflow_id        INTEGER NOT NULL REFERENCES workflows(id),
  session_id         INTEGER NOT NULL REFERENCES sessions(id),
  contact_id         INTEGER NOT NULL REFERENCES contacts(id),
  trigger_message_id INTEGER REFERENCES messages(id),
  status             TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'waiting', 'waiting_input', 'paused_human', 'completed', 'failed', 'cancelled')),
  current_node_key   TEXT,
  vars               TEXT NOT NULL DEFAULT '{}',
  reprompt_count     INTEGER NOT NULL DEFAULT 0,
  silence_followup_at      TEXT,
  silence_sweep_executed   INTEGER NOT NULL DEFAULT 0,
  reply_window_expires_at  TEXT,
  started_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions (status, started_at);
CREATE INDEX IF NOT EXISTS idx_executions_silence ON workflow_executions (status, silence_followup_at, silence_sweep_executed);

-- Unified queue: outbound sends AND delay-node resumes (one poller).
-- Replaces the suggested separate outbound_queue / scheduled_jobs tables.
CREATE TABLE IF NOT EXISTS jobs (
  id           INTEGER PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('send_message', 'resume')),
  execution_id INTEGER NOT NULL REFERENCES workflow_executions(id),
  node_key     TEXT,
  payload      TEXT NOT NULL DEFAULT '{}',
  priority     INTEGER NOT NULL DEFAULT 1, -- 1: 1-on-1 chats (preemptive), 2: bulk broadcasts
  run_at       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_poll ON jobs (status, priority, run_at);

-- Single audit-trail table covering all event types from PRD 42.
-- Subject references are nullable depending on the event.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY,
  event_type   TEXT NOT NULL,
  session_id   INTEGER,
  contact_id   INTEGER,
  execution_id INTEGER,
  message_id   INTEGER,
  data         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_execution ON events (execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type      ON events (event_type, created_at);

-- Dialogue Learning Flywheel & Distilled Knowledge Base
CREATE TABLE IF NOT EXISTS golden_dialogues (
  id              INTEGER PRIMARY KEY,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  customer_query  TEXT NOT NULL,
  human_response  TEXT NOT NULL,
  resulting_phase TEXT NOT NULL,
  was_converted   INTEGER NOT NULL DEFAULT 1,
  recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS knowledge_playbooks (
  id              INTEGER PRIMARY KEY,
  topic           TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  approved_answer TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  success_rate    REAL DEFAULT 1.0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Funnel Milestones & Micro-Conversions
CREATE TABLE IF NOT EXISTS funnel_conversions (
  id            INTEGER PRIMARY KEY,
  execution_id  INTEGER NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id   INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  variant_id    TEXT,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  value         REAL DEFAULT 0,
  converted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
