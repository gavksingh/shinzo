-- ============================================================================
-- Migration: Add Performance Indexes for Query Optimization
-- ============================================================================

-- Index for cursor-based pagination on sessions
-- Composite index on user_uuid + start_time for efficient filtering and ordering
CREATE INDEX IF NOT EXISTS idx_session_user_start_time 
ON spotlight.session(user_uuid, start_time DESC);

-- Index for model filtering in interactions
-- Allows EXISTS subqueries to quickly find sessions with specific models
CREATE INDEX IF NOT EXISTS idx_interaction_session_model
ON spotlight.interaction(session_uuid, model)
WHERE model IS NOT NULL;

-- Index for provider filtering in interactions
-- Allows EXISTS subqueries to quickly find sessions with specific providers
CREATE INDEX IF NOT EXISTS idx_interaction_session_provider
ON spotlight.interaction(session_uuid, provider)
WHERE provider IS NOT NULL;

-- Index for error filtering in interactions
-- Allows quick identification of sessions with errors
CREATE INDEX IF NOT EXISTS idx_interaction_session_error
ON spotlight.interaction(session_uuid, has_error)
WHERE has_error = true;

-- Comment on indexes
COMMENT ON INDEX spotlight.idx_session_user_start_time IS 
'Supports cursor-based pagination and user-specific session queries';

COMMENT ON INDEX spotlight.idx_interaction_session_model IS 
'Optimizes model filter queries using EXISTS pattern';

COMMENT ON INDEX spotlight.idx_interaction_session_provider IS 
'Optimizes provider filter queries using EXISTS pattern';

COMMENT ON INDEX spotlight.idx_interaction_session_error IS 
'Optimizes error filtering in session search';
