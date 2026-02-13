import { RedactionRule } from '../models/spotlight/RedactionRule'
import { logger } from '../logger'

// ============================================================================
// Built-in PII detection patterns
// ============================================================================

const BUILTIN_RULES = [
    {
        rule_name: 'Email Addresses',
        rule_type: 'builtin' as const,
        pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
        replacement: '[EMAIL_REDACTED]',
    },
    {
        rule_name: 'Phone Numbers',
        rule_type: 'builtin' as const,
        pattern: '(\\+?1[\\-.\\s]?)?\\(?\\d{3}\\)?[\\-.\\s]?\\d{3}[\\-.\\s]?\\d{4}',
        replacement: '[PHONE_REDACTED]',
    },
    {
        rule_name: 'API Keys',
        rule_type: 'builtin' as const,
        pattern: '(sk_|pk_|api_|key_|token_)[a-zA-Z0-9_\\-]{16,}',
        replacement: '[API_KEY_REDACTED]',
    },
    {
        rule_name: 'SSN',
        rule_type: 'builtin' as const,
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        replacement: '[SSN_REDACTED]',
    },
    {
        rule_name: 'Credit Card Numbers',
        rule_type: 'builtin' as const,
        pattern: '\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}',
        replacement: '[CC_REDACTED]',
    },
    {
        rule_name: 'IP Addresses',
        rule_type: 'builtin' as const,
        pattern: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
        replacement: '[IP_REDACTED]',
    },
]

// ============================================================================
// Lazy-seed built-in rules for a user on first access
// ============================================================================

export async function ensureBuiltinRules(userUuid: string): Promise<void> {
    const existingCount = await RedactionRule.count({
        where: { user_uuid: userUuid, is_builtin: true },
    })

    if (existingCount > 0) return // already seeded

    logger.info({ message: 'Seeding built-in redaction rules', userUuid })

    const rulesToCreate = BUILTIN_RULES.map((rule) => ({
        user_uuid: userUuid,
        ...rule,
        is_enabled: false,
        is_builtin: true,
        target_fields: ['request_data', 'response_data', 'tool_input', 'tool_output', 'system_prompt'],
    }))

    await RedactionRule.bulkCreate(rulesToCreate)
}

// ============================================================================
// Fetch enabled redaction rules for a user
// ============================================================================

export async function getRedactionRules(userUuid: string) {
    await ensureBuiltinRules(userUuid)
    return RedactionRule.findAll({
        where: { user_uuid: userUuid, is_enabled: true },
        order: [['created_at', 'ASC']],
    })
}

// ============================================================================
// Recursive redaction engine
// ============================================================================

function redactString(value: string, rules: Array<{ pattern: string; replacement: string }>): string {
    let result = value
    for (const rule of rules) {
        try {
            const regex = new RegExp(rule.pattern, 'gi')
            result = result.replace(regex, rule.replacement)
        } catch (e) {
            // Skip invalid patterns
            logger.warn({ message: 'Invalid redaction pattern', pattern: rule.pattern })
        }
    }
    return result
}

function redactValue(value: any, rules: Array<{ pattern: string; replacement: string }>): any {
    if (value === null || value === undefined) return value

    if (typeof value === 'string') {
        return redactString(value, rules)
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactValue(item, rules))
    }

    if (typeof value === 'object') {
        const result: Record<string, any> = {}
        for (const [key, val] of Object.entries(value)) {
            result[key] = redactValue(val, rules)
        }
        return result
    }

    return value
}

// ============================================================================
// Apply redaction rules to session export data
// ============================================================================

export function applyRedaction(
    data: any,
    rules: Array<{ pattern: string; replacement: string; target_fields: string[] }>
): any {
    if (!rules || rules.length === 0) return data

    const redacted = JSON.parse(JSON.stringify(data)) // deep clone

    // Redact top-level session fields
    const sessionTargetFields = ['environment', 'metadata']
    for (const field of sessionTargetFields) {
        if (redacted[field]) {
            const applicableRules = rules.filter((r) => r.target_fields.includes(field))
            if (applicableRules.length > 0) {
                redacted[field] = redactValue(redacted[field], applicableRules)
            }
        }
    }

    // Redact interactions
    if (redacted.interactions && Array.isArray(redacted.interactions)) {
        redacted.interactions = redacted.interactions.map((interaction: any) => {
            const interactionFields = ['request_data', 'response_data', 'system_prompt', 'error_message']
            for (const field of interactionFields) {
                if (interaction[field]) {
                    const applicableRules = rules.filter((r) => r.target_fields.includes(field))
                    if (applicableRules.length > 0) {
                        interaction[field] = redactValue(interaction[field], applicableRules)
                    }
                }
            }

            // Redact tool usages
            if (interaction.toolUsages && Array.isArray(interaction.toolUsages)) {
                interaction.toolUsages = interaction.toolUsages.map((tu: any) => {
                    for (const field of ['tool_input', 'tool_output']) {
                        if (tu[field]) {
                            const applicableRules = rules.filter((r) => r.target_fields.includes(field))
                            if (applicableRules.length > 0) {
                                tu[field] = redactValue(tu[field], applicableRules)
                            }
                        }
                    }
                    return tu
                })
            }

            // Also handle tool_usages (frontend naming)
            if (interaction.tool_usages && Array.isArray(interaction.tool_usages)) {
                interaction.tool_usages = interaction.tool_usages.map((tu: any) => {
                    for (const field of ['tool_input', 'tool_output']) {
                        if (tu[field]) {
                            const applicableRules = rules.filter((r) => r.target_fields.includes(field))
                            if (applicableRules.length > 0) {
                                tu[field] = redactValue(tu[field], applicableRules)
                            }
                        }
                    }
                    return tu
                })
            }

            return interaction
        })
    }

    return redacted
}

// ============================================================================
// CSV conversion for session export
// ============================================================================

export function convertSessionToCSV(sessionData: any): string {
    const rows: string[][] = []

    // Header row
    const headers = [
        'interaction_uuid',
        'request_timestamp',
        'response_timestamp',
        'model',
        'provider',
        'input_tokens',
        'output_tokens',
        'cache_read_input_tokens',
        'latency_ms',
        'status',
        'error_type',
        'error_message',
        'tool_count',
    ]
    rows.push(headers)

    // Session metadata as a comment row
    if (sessionData.session_id || sessionData.uuid) {
        rows.push([`# Session: ${sessionData.session_id || sessionData.uuid}`])
    }

    // Interaction rows
    const interactions = sessionData.interactions || []
    for (const interaction of interactions) {
        const toolCount =
            (interaction.toolUsages?.length || 0) +
            (interaction.tool_usages?.length || 0)

        rows.push([
            csvEscape(interaction.uuid || ''),
            csvEscape(interaction.request_timestamp || ''),
            csvEscape(interaction.response_timestamp || ''),
            csvEscape(interaction.model || ''),
            csvEscape(interaction.provider || ''),
            String(interaction.input_tokens || 0),
            String(interaction.output_tokens || 0),
            String(interaction.cache_read_input_tokens || 0),
            String(interaction.latency_ms || 0),
            csvEscape(interaction.status || ''),
            csvEscape(interaction.error_type || ''),
            csvEscape(interaction.error_message || ''),
            String(toolCount),
        ])
    }

    return rows.map((row) => row.join(',')).join('\n')
}

function csvEscape(value: string): string {
    if (!value) return ''
    // Wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}
