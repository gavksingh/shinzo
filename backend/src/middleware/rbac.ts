import { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../logger'

// ============================================================================
// Types
// ============================================================================

export type Permission = 'read' | 'write' | 'delete'
export type Resource = 'sessions' | 'analytics' | 'export' | 'share' | 'redaction'

// ============================================================================
// Role Permissions Matrix
// ============================================================================

/**
 * Defines permissions for each role
 */
export const ROLE_PERMISSIONS: Record<string, Record<Resource, Permission[]>> = {
    read_only: {
        sessions: ['read'],
        analytics: ['read'],
        export: [],
        share: [],
        redaction: ['read'],
    },
    read_write: {
        sessions: ['read'],
        analytics: ['read'],
        export: ['read', 'write'],
        share: ['read', 'write'],
        redaction: ['read'],
    },
    admin: {
        sessions: ['read', 'write', 'delete'],
        analytics: ['read'],
        export: ['read', 'write'],
        share: ['read', 'write', 'delete'],
        redaction: ['read', 'write', 'delete'],
    },
}

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Check if a role has permission for a resource action
 * @param role - User role (read_only, read_write, admin)
 * @param resource - Resource being accessed
 * @param permission - Required permission level
 * @returns true if user has permission
 */
export function hasPermission(
    role: string,
    resource: Resource,
    permission: Permission
): boolean {
    const rolePerms = ROLE_PERMISSIONS[role]
    if (!rolePerms) {
        logger.warn({ message: 'Unknown role', role })
        return false
    }

    const resourcePerms = rolePerms[resource]
    if (!resourcePerms) {
        logger.warn({ message: 'Unknown resource', resource })
        return false
    }

    return resourcePerms.includes(permission)
}

// ============================================================================
// RBAC Middleware
// ============================================================================

/**
 * Creates a preHandler middleware that requires specific permission
 * @param resource - Resource being accessed
 * @param permission - Required permission level
 * @returns Fastify preHandler function
 */
export function requirePermission(resource: Resource, permission: Permission) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        // Extract user role from request (injected by auth middleware)
        const userRole = (request as any).userRole || 'read_only'

        logger.debug({
            message: 'Checking RBAC permission',
            userRole,
            resource,
            permission,
            path: request.url,
        })

        if (!hasPermission(userRole, resource, permission)) {
            logger.warn({
                message: 'RBAC permission denied',
                userRole,
                resource,
                permission,
                path: request.url,
                userUuid: (request as any).userUuid,
            })

            return reply.status(403).send({
                error: 'Forbidden',
                message: `Insufficient permissions. Required: ${permission} access to ${resource}`,
            })
        }

        // Permission granted - continue
        logger.debug({
            message: 'RBAC permission granted',
            userRole,
            resource,
            permission,
        })
    }
}

/**
 * Get role from API key type
 * Maps Shinzo API key types to RBAC roles
 * @param keyType - API key type from database
 * @returns RBAC role
 */
export function getRoleFromKeyType(keyType: string): string {
    const roleMap: Record<string, string> = {
        read_only: 'read_only',
        read_write: 'read_write',
        admin: 'admin',
    }

    return roleMap[keyType] || 'read_only'
}

/**
 * Middleware to extract and set user role from Shinzo API key
 * Should be applied after authentication
 */
export async function extractUserRole(request: FastifyRequest, reply: FastifyReply) {
    const req = request as any

    // If Shinzo key is authenticated, get role from key_type
    if (req.shinzoKey && req.shinzoKey.key_type) {
        req.userRole = getRoleFromKeyType(req.shinzoKey.key_type)
        logger.debug({
            message: 'User role extracted from Shinzo key',
            userRole: req.userRole,
            keyType: req.shinzoKey.key_type,
        })
    } else {
        // Default to read_write for regular authenticated users
        req.userRole = 'read_write'
        logger.debug({
            message: 'Default user role assigned',
            userRole: req.userRole,
        })
    }
}
