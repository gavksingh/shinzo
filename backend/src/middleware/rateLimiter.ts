import { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../logger'

// ============================================================================
// Rate Limiter Configuration
// ============================================================================

interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Max requests per window
    keyGenerator: (request: FastifyRequest) => string
    skipSuccessfulRequests?: boolean
}

interface RateLimitStore {
    [key: string]: {
        count: number
        resetTime: number
    }
}

// In-memory store (use Redis in production for distributed systems)
const store: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    Object.keys(store).forEach(key => {
        if (store[key].resetTime < now) {
            delete store[key]
        }
    })
}, 5 * 60 * 1000)

// ============================================================================
// Rate Limiter Middleware Factory
// ============================================================================

export function createRateLimiter(config: RateLimitConfig) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const key = config.keyGenerator(request)
        const now = Date.now()

        // Initialize or get existing entry
        if (!store[key] || store[key].resetTime < now) {
            store[key] = {
                count: 0,
                resetTime: now + config.windowMs
            }
        }

        // Increment request count
        store[key].count++

        // Check if limit exceeded
        if (store[key].count > config.maxRequests) {
            const retryAfter = Math.ceil((store[key].resetTime - now) / 1000)

            logger.warn({
                message: 'Rate limit exceeded',
                key,
                count: store[key].count,
                limit: config.maxRequests,
                retryAfter
            })

            reply.status(429).send({
                error: {
                    type: 'rate_limit_exceeded',
                    message: 'Too many requests. Please try again later.',
                    retryAfter
                }
            })
            return
        }

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', config.maxRequests)
        reply.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - store[key].count))
        reply.header('X-RateLimit-Reset', new Date(store[key].resetTime).toISOString())
    }
}

// ============================================================================
// Predefined Rate Limiters for Analytics Endpoints
// ============================================================================

/**
 * Rate limiter for session search endpoint
 * Limit: 100 requests per minute per user
 */
export const sessionSearchRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (request: FastifyRequest) => {
        const userUuid = (request as any).user?.uuid || request.ip
        return `session_search:${userUuid}`
    }
})

/**
 * Rate limiter for session export endpoint
 * Limit: 10 requests per minute per user (more restrictive due to heavy operation)
 */
export const sessionExportRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (request: FastifyRequest) => {
        const userUuid = (request as any).user?.uuid || request.ip
        return `session_export:${userUuid}`
    }
})

/**
 * Rate limiter for redaction rule updates
 * Limit: 20 requests per minute per user
 */
export const redactionRuleRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyGenerator: (request: FastifyRequest) => {
        const userUuid = (request as any).user?.uuid || request.ip
        return `redaction_rule:${userUuid}`
    }
})

/**
 * Rate limiter for shared session access
 * Limit: 50 requests per minute per IP (public endpoint)
 */
export const sharedSessionRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    keyGenerator: (request: FastifyRequest) => {
        return `shared_session:${request.ip}`
    }
})

/**
 * Rate limiter for analytics summary endpoint
 * Limit: 30 requests per minute per user
 */
export const analyticsSummaryRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (request: FastifyRequest) => {
        const userUuid = (request as any).user?.uuid || request.ip
        return `analytics_summary:${userUuid}`
    }
})
