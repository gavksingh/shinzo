import { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../logger'

// ============================================================================
// Types
// ============================================================================

interface PerformanceMetric {
    path: string
    method: string
    responseTime: number
    statusCode: number
    userUuid?: string
    cacheHit?: boolean
    timestamp: Date
}

// ============================================================================
// Metrics Storage
// ============================================================================

// In-memory metrics (last 1000 requests)
const metrics: PerformanceMetric[] = []
const MAX_METRICS = 1000

// Slow request threshold (milliseconds)
const SLOW_REQUEST_THRESHOLD = 1000

// ============================================================================
// Performance Monitoring Middleware
// ============================================================================

/**
 * Tracks request/response performance metrics
 * Logs slow requests and stores metrics for analysis
 */
export async function performanceMonitoring(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const startTime = Date.now()

    // Add hook to measure response time
    reply.addHook('onSend', async (request, reply, payload) => {
        const responseTime = Date.now() - startTime

        const metric: PerformanceMetric = {
            path: request.url,
            method: request.method,
            responseTime,
            statusCode: reply.statusCode,
            userUuid: (request as any).userUuid,
            cacheHit: (request as any).cacheHit,
            timestamp: new Date(),
        }

        // Store metric (circular buffer)
        metrics.push(metric)
        if (metrics.length > MAX_METRICS) {
            metrics.shift()
        }

        // Log slow requests
        if (responseTime > SLOW_REQUEST_THRESHOLD) {
            logger.warn({
                message: 'Slow request detected',
                path: metric.path,
                method: metric.method,
                responseTime: metric.responseTime,
                statusCode: metric.statusCode,
                userUuid: metric.userUuid,
            })
        }

        // Log analytics requests for monitoring
        if (request.url.includes('/analytics/')) {
            logger.debug({
                message: 'Analytics request completed',
                path: metric.path,
                responseTime: metric.responseTime,
                cacheHit: metric.cacheHit,
            })
        }
    })
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0
    const index = Math.ceil(arr.length * p) - 1
    return arr[index]
}

/**
 * Get performance statistics for all requests
 */
export function getPerformanceStats() {
    if (metrics.length === 0) {
        return {
            message: 'No metrics collected yet',
            total_requests: 0,
        }
    }

    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b)
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length

    const p50 = percentile(responseTimes, 0.50)
    const p95 = percentile(responseTimes, 0.95)
    const p99 = percentile(responseTimes, 0.99)

    const slowRequests = metrics.filter(m => m.responseTime > SLOW_REQUEST_THRESHOLD).length
    const cacheHits = metrics.filter(m => m.cacheHit).length
    const cacheHitRate = (cacheHits / metrics.length * 100).toFixed(2)

    // Status code distribution
    const statusCodes: Record<number, number> = {}
    metrics.forEach(m => {
        statusCodes[m.statusCode] = (statusCodes[m.statusCode] || 0) + 1
    })

    return {
        total_requests: metrics.length,
        avg_response_time_ms: Math.round(avgResponseTime),
        p50_response_time_ms: Math.round(p50),
        p95_response_time_ms: Math.round(p95),
        p99_response_time_ms: Math.round(p99),
        slow_requests: slowRequests,
        slow_request_rate: `${((slowRequests / metrics.length) * 100).toFixed(2)}%`,
        cache_hit_rate: `${cacheHitRate}%`,
        cache_hits: cacheHits,
        cache_misses: metrics.length - cacheHits,
        status_codes: statusCodes,
        time_window: {
            start: metrics[0]?.timestamp,
            end: metrics[metrics.length - 1]?.timestamp,
        },
    }
}

/**
 * Get performance statistics for specific endpoint
 */
export function getEndpointStats(pathPattern: string) {
    const endpointMetrics = metrics.filter(m => m.path.includes(pathPattern))

    if (endpointMetrics.length === 0) {
        return {
            message: `No metrics found for pattern: ${pathPattern}`,
            total_requests: 0,
        }
    }

    const responseTimes = endpointMetrics.map(m => m.responseTime).sort((a, b) => a - b)
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length

    return {
        endpoint_pattern: pathPattern,
        total_requests: endpointMetrics.length,
        avg_response_time_ms: Math.round(avgResponseTime),
        p95_response_time_ms: Math.round(percentile(responseTimes, 0.95)),
        cache_hits: endpointMetrics.filter(m => m.cacheHit).length,
        slow_requests: endpointMetrics.filter(m => m.responseTime > SLOW_REQUEST_THRESHOLD).length,
    }
}

/**
 * Get slowest requests
 */
export function getSlowestRequests(limit: number = 10) {
    return metrics
        .sort((a, b) => b.responseTime - a.responseTime)
        .slice(0, limit)
        .map(m => ({
            path: m.path,
            method: m.method,
            response_time_ms: m.responseTime,
            status_code: m.statusCode,
            timestamp: m.timestamp,
            cache_hit: m.cacheHit,
        }))
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics() {
    metrics.length = 0
    logger.info({ message: 'Performance metrics cleared' })
}
