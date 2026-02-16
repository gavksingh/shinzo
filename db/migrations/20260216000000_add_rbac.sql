-- ============================================================================
-- Migration: Add RBAC Support for Session Analytics
-- ============================================================================

-- Extend key_type enum to include admin role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t 
                   JOIN pg_enum e ON t.oid = e.enumtypid  
                   WHERE t.typname = 'key_type_enum' 
                   AND e.enumlabel = 'admin') THEN
        ALTER TYPE spotlight.key_type_enum ADD VALUE 'admin';
    END IF;
END$$;

-- Add permissions column for fine-grained access control
ALTER TABLE spotlight.shinzo_api_key
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Add comment explaining permissions structure
COMMENT ON COLUMN spotlight.shinzo_api_key.permissions IS 
'Fine-grained permissions in format: {"resource": ["permission1", "permission2"]}. 
Example: {"sessions": ["read"], "export": ["read", "write"]}';

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_api_key_permissions 
ON spotlight.shinzo_api_key USING gin(permissions);

-- Add index on key_type for role-based queries
CREATE INDEX IF NOT EXISTS idx_api_key_type 
ON spotlight.shinzo_api_key(key_type);

-- Update existing keys with default permissions based on key_type
UPDATE spotlight.shinzo_api_key
SET permissions = 
    CASE key_type
        WHEN 'read_only' THEN '{
            "sessions": ["read"],
            "analytics": ["read"],
            "redaction": ["read"]
        }'::jsonb
        WHEN 'read_write' THEN '{
            "sessions": ["read"],
            "analytics": ["read"],
            "export": ["read", "write"],
            "share": ["read", "write"],
            "redaction": ["read"]
        }'::jsonb
        ELSE '{}'::jsonb
    END
WHERE permissions = '{}'::jsonb;

-- Add migration tracking
INSERT INTO spotlight.migrations (name, applied_at)
VALUES ('20260216000000_add_rbac', NOW())
ON CONFLICT DO NOTHING;
