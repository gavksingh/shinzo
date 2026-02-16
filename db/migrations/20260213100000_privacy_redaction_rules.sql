-- migrate:up

-- Redaction rules for privacy-safe session exports and shared sessions
CREATE TABLE IF NOT EXISTS spotlight.redaction_rule (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL REFERENCES main."user"(uuid) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('regex', 'field_name', 'builtin')),
    pattern TEXT NOT NULL,
    replacement TEXT NOT NULL DEFAULT '[REDACTED]',
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    target_fields TEXT[] NOT NULL DEFAULT ARRAY['request_data','response_data','tool_input','tool_output','system_prompt'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redaction_rule_user_uuid ON spotlight.redaction_rule(user_uuid);
CREATE INDEX IF NOT EXISTS idx_redaction_rule_enabled ON spotlight.redaction_rule(user_uuid, is_enabled) WHERE is_enabled = true;

-- migrate:down

DROP INDEX IF EXISTS spotlight.idx_redaction_rule_enabled;
DROP INDEX IF EXISTS spotlight.idx_redaction_rule_user_uuid;
DROP TABLE IF EXISTS spotlight.redaction_rule;
