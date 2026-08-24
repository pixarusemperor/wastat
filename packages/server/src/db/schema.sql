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
  id         INTEGER PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
                     CHECK (status IN ('running', 'waiting', 'waiting_input', 'completed', 'failed', 'cancelled')),
  current_node_key   TEXT,
  vars               TEXT NOT NULL DEFAULT '{}',
  reprompt_count     INTEGER NOT NULL DEFAULT 0,
  started_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions (status, started_at);

-- Unified queue: outbound sends AND delay-node resumes (one poller).
-- Replaces the suggested separate outbound_queue / scheduled_jobs tables.
CREATE TABLE IF NOT EXISTS jobs (
  id           INTEGER PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('send_message', 'resume')),
  execution_id INTEGER NOT NULL REFERENCES workflow_executions(id),
  node_key     TEXT,
  payload      TEXT NOT NULL DEFAULT '{}',
  run_at       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_poll ON jobs (status, run_at);

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
