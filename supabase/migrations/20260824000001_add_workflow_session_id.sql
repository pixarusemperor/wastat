-- Migration: Add session_id to workflows and support mark_read and send_presence job types
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_session ON workflows (session_id, active);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_type_check CHECK (type IN ('send_message', 'mark_read', 'send_presence', 'resume'));

CREATE INDEX IF NOT EXISTS idx_events_execution_ordered ON events (execution_id, id ASC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_lookup ON workflow_executions (session_id, contact_id, status);
