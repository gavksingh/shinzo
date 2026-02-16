import { sequelize } from '../dbClient'
import { logger } from '../logger'

// ============================================================================
// Audit Log Service
// ============================================================================

export interface AuditLogEntry {
    userUuid: string
    action: string
    resourceType: string
    resourceUuid?: string
    metadata?: Record<string, any>
    ipAddress?: string
    userAgent?: string
}

/**
 * Creates an audit log entry for sensitive operations
 * @param entry - The audit log entry data
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
        await sequelize.query(
            `INSERT INTO spotlight.audit_log 
             (user_uuid, action, resource_type, resource_uuid, metadata, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            {
                bind: [
                    entry.userUuid,
                    entry.action,
                    entry.resourceType,
                    entry.resourceUuid || null,
                    JSON.stringify(entry.metadata || {}),
                    entry.ipAddress || null,
                    entry.userAgent || null
                ]
            }
        )

        logger.info({
            message: 'Audit log created',
            action: entry.action,
            resourceType: entry.resourceType,
            userUuid: entry.userUuid
        })
    } catch (error) {
        // Don't fail the operation if audit logging fails
        logger.error({
            message: 'Failed to create audit log',
            error,
            entry
        })
    }
}

/**
 * Fetches audit logs for a user
 * @param userUuid - The user UUID
 * @param limit - Maximum number of logs to return
 * @param offset - Offset for pagination
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
    userUuid: string,
    limit: number = 50,
    offset: number = 0
): Promise<any[]> {
    const [results] = await sequelize.query(
        `SELECT uuid, action, resource_type, resource_uuid, metadata, ip_address, created_at
         FROM spotlight.audit_log
         WHERE user_uuid = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        { bind: [userUuid, limit, offset] }
    )

    return results as any[]
}

/**
 * Fetches audit logs for a specific resource
 * @param resourceType - The resource type (e.g., 'session', 'redaction_rule')
 * @param resourceUuid - The resource UUID
 * @param limit - Maximum number of logs to return
 * @returns Array of audit log entries
 */
export async function getResourceAuditLogs(
    resourceType: string,
    resourceUuid: string,
    limit: number = 50
): Promise<any[]> {
    const [results] = await sequelize.query(
        `SELECT uuid, user_uuid, action, metadata, ip_address, created_at
         FROM spotlight.audit_log
         WHERE resource_type = $1 AND resource_uuid = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        { bind: [resourceType, resourceUuid, limit] }
    )

    return results as any[]
}

// ============================================================================
// Audit Action Constants
// ============================================================================

export const AuditActions = {
    // Session actions
    SESSION_EXPORT: 'session_export',
    SESSION_SHARE_CREATE: 'session_share_create',
    SESSION_SHARE_DELETE: 'session_share_delete',
    SESSION_SHARE_ACCESS: 'session_share_access',
    SESSION_DELETE: 'session_delete',

    // Redaction rule actions
    REDACTION_RULE_CREATE: 'redaction_rule_create',
    REDACTION_RULE_UPDATE: 'redaction_rule_update',
    REDACTION_RULE_DELETE: 'redaction_rule_delete',
    REDACTION_RULE_TOGGLE: 'redaction_rule_toggle',

    // Data access actions
    SESSION_SEARCH: 'session_search',
    ANALYTICS_SUMMARY_VIEW: 'analytics_summary_view',

    // Privacy actions
    DATA_EXPORT_REQUEST: 'data_export_request',
    DATA_DELETE_REQUEST: 'data_delete_request',
} as const
