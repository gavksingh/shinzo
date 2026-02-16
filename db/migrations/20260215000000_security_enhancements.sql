-- Security Enhancements Migration
-- Adds audit logging, session share expiration, and performance indexes

-- ============================================================================
-- Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS spotlight.audit_log (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid UUID NOT NULL REFERENCES public."user"(uuid) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_uuid UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient audit log queries
CREATE INDEX idx_audit_log_user_created ON spotlight.audit_log(user_uuid, created_at DESC);
CREATE INDEX idx_audit_log_resource ON spotlight.audit_log(resource_type, resource_uuid);
CREATE INDEX idx_audit_log_action ON spotlight.audit_log(action, created_at DESC);

-- ============================================================================
-- Session Share Enhancements
-- ============================================================================
ALTER TABLE spotlight.session_share 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_access_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_ip_addresses INET[];

-- Index for expired share cleanup
CREATE INDEX idx_session_share_expires ON spotlight.session_share(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- Performance Indexes for Session Analytics
-- ============================================================================

-- Session table indexes
CREATE INDEX IF NOT EXISTS idx_session_user_created ON spotlight.session(user_uuid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_error_count ON spotlight.session(error_count) WHERE error_count > 0;
CREATE INDEX IF NOT EXISTS idx_session_environment ON spotlight.session(environment) WHERE environment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_bookmarked ON spotlight.session(user_uuid, is_bookmarked) WHERE is_bookmarked = TRUE;

-- Interaction table indexes
CREATE INDEX IF NOT EXISTS idx_interaction_session_timestamp ON spotlight.interaction(session_uuid, request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_status ON spotlight.interaction(status, request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_model ON spotlight.interaction(model, request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_provider ON spotlight.interaction(provider, request_timestamp DESC);

-- Redaction rule indexes
CREATE INDEX IF NOT EXISTS idx_redaction_rule_user_enabled ON spotlight.redaction_rule(user_uuid, is_enabled) WHERE is_enabled = TRUE;

-- ============================================================================
-- Add constraints for data integrity
-- ============================================================================

-- Ensure access count doesn't exceed max
ALTER TABLE spotlight.session_share 
  ADD CONSTRAINT check_access_count CHECK (
    max_access_count IS NULL OR access_count <= max_access_count
  );

-- Ensure expires_at is in the future when created
ALTER TABLE spotlight.session_share 
  ADD CONSTRAINT check_expires_future CHECK (
    expires_at IS NULL OR expires_at > created_at
  );
