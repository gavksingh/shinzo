-- migrate:up

-- Add session metadata columns for session replay feature
ALTER TABLE spotlight.session ADD COLUMN IF NOT EXISTS environment JSONB DEFAULT '{}';
ALTER TABLE spotlight.session ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE spotlight.session ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

-- Populate error_count for existing sessions
UPDATE spotlight.session s
SET error_count = (
  SELECT COUNT(*)
  FROM spotlight.interaction i
  WHERE i.session_uuid = s.uuid AND i.status = 'error'
);

-- Add partial index for sessions with errors (idx_session_start_time already exists in initial schema)
CREATE INDEX IF NOT EXISTS idx_session_error_count ON spotlight.session(error_count) WHERE error_count > 0;

-- migrate:down

DROP INDEX IF EXISTS spotlight.idx_session_error_count;
ALTER TABLE spotlight.session DROP COLUMN IF EXISTS error_count;
ALTER TABLE spotlight.session DROP COLUMN IF EXISTS metadata;
ALTER TABLE spotlight.session DROP COLUMN IF EXISTS environment;
