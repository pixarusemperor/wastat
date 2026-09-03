-- ============================================================
-- WaStat V2: Multi-Provider WhatsApp Translation Layer
-- Supports Wasender and Periskope with Zero Downtime
-- ============================================================

-- 1. Sessions: Multi-provider support and JSONB configuration
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'wasender';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}';

-- Composite unique index allowing identical remote IDs across different providers
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_provider_scoping ON sessions (provider, provider_session_id);

-- 2. Messages: Asynchronous Queue ID correlator
ALTER TABLE messages ADD COLUMN IF NOT EXISTS queue_id TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_queue_id ON messages (queue_id);

-- 3. Webhook Idempotency Ledger
CREATE TABLE IF NOT EXISTS webhook_idempotency (
  id         BIGSERIAL PRIMARY KEY,
  provider   TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);
