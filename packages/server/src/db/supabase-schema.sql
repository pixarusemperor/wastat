-- ============================================================
-- WaStat V2 Supabase PostgreSQL Production Schema
-- Designed for High-Volume WhatsApp Sales Automation & Anti-Ban
-- ============================================================

-- 1. Sessions (Wasender Companion QR sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  provider_session_id TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'disconnected',
  api_key_encrypted   BYTEA,
  webhook_secret      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Contacts (WhatsApp Users & Leads)
CREATE TABLE IF NOT EXISTS contacts (
  id               BIGSERIAL PRIMARY KEY,
  phone            TEXT NOT NULL UNIQUE,
  name             TEXT,
  funnel_phase     TEXT NOT NULL DEFAULT 'unassigned',
  bot_status       TEXT NOT NULL DEFAULT 'active',
  bot_paused_until TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Contact Custom Attributes (Customer 360)
CREATE TABLE IF NOT EXISTS contact_attributes (
  id          BIGSERIAL PRIMARY KEY,
  contact_id  BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, key)
);

-- 4. Contact Tags
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id  BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag)
);

-- 5. Private Internal Team Notes
CREATE TABLE IF NOT EXISTS private_notes (
  id          BIGSERIAL PRIMARY KEY,
  contact_id  BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author      TEXT NOT NULL DEFAULT 'operator',
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Funnel Transitions Audit Trail
CREATE TABLE IF NOT EXISTS funnel_transitions (
  id              BIGSERIAL PRIMARY KEY,
  contact_id      BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_phase      TEXT NOT NULL,
  to_phase        TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  operator_notes  TEXT,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Media Assets (Stored in Cloudflare R2)
CREATE TABLE IF NOT EXISTS media_assets (
  id         BIGSERIAL PRIMARY KEY,
  filename   TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size       BIGINT NOT NULL,
  r2_key     TEXT NOT NULL UNIQUE,
  hash       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Experiments (A/B Test Buckets)
CREATE TABLE IF NOT EXISTS experiments (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Workflows (Visual Graph Automations)
CREATE TABLE IF NOT EXISTS workflows (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  session_id    BIGINT REFERENCES sessions(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT false,
  experiment_id BIGINT REFERENCES experiments(id) ON DELETE SET NULL,
  ai_enabled    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Workflow Nodes (Graph vertices)
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id          BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_key    TEXT NOT NULL,
  type        TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x  REAL NOT NULL DEFAULT 0,
  position_y  REAL NOT NULL DEFAULT 0,
  UNIQUE (workflow_id, node_key)
);

-- 11. Workflow Edges (Graph transitions)
CREATE TABLE IF NOT EXISTS workflow_edges (
  id          BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_key  TEXT NOT NULL,
  target_key  TEXT NOT NULL,
  handle      TEXT,
  UNIQUE (workflow_id, source_key, target_key, handle)
);

-- 12. Experiment Sticky Variant Assignments
CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id BIGINT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  contact_id    BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workflow_id   BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, contact_id)
);

-- 13. Messages (Inbound & Outbound WhatsApp traffic)
CREATE TABLE IF NOT EXISTS messages (
  id                    BIGSERIAL PRIMARY KEY,
  session_id            BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contact_id            BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction             TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  message_type          TEXT NOT NULL,
  text                  TEXT,
  media_id              BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  provider_message_id   TEXT UNIQUE,
  in_reply_to_id        BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  workflow_execution_id BIGINT,
  node_key              TEXT,
  status                TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_event             JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (session_id, contact_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_execution    ON messages (workflow_execution_id);

-- 14. Workflow Executions (Active Flow instances)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id                      BIGSERIAL PRIMARY KEY,
  workflow_id             BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  session_id              BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contact_id              BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  trigger_message_id      BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running', 'waiting', 'waiting_input', 'paused_human', 'completed', 'failed', 'cancelled')),
  current_node_key        TEXT,
  vars                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  reprompt_count          INTEGER NOT NULL DEFAULT 0,
  silence_followup_at     TIMESTAMPTZ,
  silence_sweep_executed  BOOLEAN NOT NULL DEFAULT false,
  reply_window_expires_at TIMESTAMPTZ,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions (status, started_at);
CREATE INDEX IF NOT EXISTS idx_executions_silence ON workflow_executions (status, silence_followup_at, silence_sweep_executed);

-- 15. Queue Jobs (Rate-limited sends & delays)
CREATE TABLE IF NOT EXISTS jobs (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('send_message', 'resume')),
  execution_id BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_key     TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority     INTEGER NOT NULL DEFAULT 1, -- 1: 1-on-1 chats (preemptive), 2: bulk broadcasts
  run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_poll ON jobs (status, priority, run_at);

-- 16. Audit Events
CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,
  session_id   BIGINT,
  contact_id   BIGINT,
  execution_id BIGINT,
  message_id   BIGINT,
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_execution ON events (execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type      ON events (event_type, created_at);

-- 17. DeskcommCRM Dialogue Learning Flywheel
CREATE TABLE IF NOT EXISTS golden_dialogues (
  id              BIGSERIAL PRIMARY KEY,
  contact_id      BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  customer_query  TEXT NOT NULL,
  human_response  TEXT NOT NULL,
  resulting_phase TEXT NOT NULL,
  was_converted   BOOLEAN NOT NULL DEFAULT true,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. Distilled Knowledge Base Playbooks
CREATE TABLE IF NOT EXISTS knowledge_playbooks (
  id              BIGSERIAL PRIMARY KEY,
  topic           TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  approved_answer TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  success_rate    REAL DEFAULT 1.0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Funnel Milestones & Conversions
CREATE TABLE IF NOT EXISTS funnel_conversions (
  id            BIGSERIAL PRIMARY KEY,
  execution_id  BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id   BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  variant_id    TEXT,
  contact_id    BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  value         REAL DEFAULT 0,
  converted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. E-commerce Products Catalog
CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  category    TEXT,
  media_id    BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. Cartesian Group Broadcast Dispatches
CREATE TABLE IF NOT EXISTS group_dispatches (
  id            BIGSERIAL PRIMARY KEY,
  campaign_id   BIGINT,
  product_id    BIGINT REFERENCES products(id) ON DELETE CASCADE,
  group_jid     TEXT NOT NULL,
  template_text TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed')),
  priority      INTEGER NOT NULL DEFAULT 2, -- Priority 2 for broadcast, Priority 1 for 1-on-1 chat
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_dispatches_poll ON group_dispatches (status, priority, run_at);
