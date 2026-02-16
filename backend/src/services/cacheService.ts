import NodeCache from 'node-cache'
import crypto from 'crypto'
import { logger } from '../logger'

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_TTL = {
    SEARCH: 300,        // 5 minutes
    SUMMARY: 600,       // 10 minutes
    TIMESERIES: 900,    // 15 minutes
    DETAIL: 1800,       // 30 minutes
}

// ============================================================================
// Cache Instance
// ============================================================================

const cache = new NodeCache({
    stdTTL: 300,           // 5 minutes default
    checkperiod: 60,       // Check for expired keys every minute
    useClones: false,      // Better performance, immutable data
    maxKeys: 1000,         // Max 1000 cache entries
})

// ============================================================================
// Cache Statistics
// ============================================================================

let hits = 0
let misses = 0

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generates a cache key from endpoint, user, and filters
 * @param endpoint - Endpoint name (e.g., 'search', 'summary')
 * @param userUuid - User UUID for isolation
 * @param filters - Optional filters object
 * @returns Cache key string
 */
export function generateCacheKey(
    endpoint: string,
    userUuid: string,
    filters?: any
): string {
    const filterHash = filters
        ? crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex').slice(0, 8)
        : 'default'

    return `${endpoint}:${userUuid}:${filterHash}`
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Retrieves a value from cache
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function getCache<T>(key: string): Promise<T | null> {
    const value = cache.get<T>(key)
    if (value !== undefined) {
        hits++
        logger.debug({ message: 'Cache hit', key, hits, misses })
        return value
    }
    misses++
    logger.debug({ message: 'Cache miss', key, hits, misses })
    return null
}

/**
 * Stores a value in cache
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Optional TTL in seconds (overrides default)
 */
export async function setCache<T>(
    key: string,
    value: T,
    ttl?: number
): Promise<void> {
    const success = cache.set(key, value, ttl || 0)
    if (success) {
        logger.debug({ message: 'Cache set', key, ttl: ttl || 'default' })
    } else {
        logger.warn({ message: 'Failed to set cache', key })
    }
}

/**
 * Deletes a specific key from cache
 * @param key - Cache key to delete
 * @returns Number of deleted keys
 */
export function deleteCache(key: string): number {
    return cache.del(key)
}

/**
 * Invalidates all cache entries matching a pattern
 * @param pattern - Pattern to match (substring)
 * @returns Number of invalidated keys
 */
export function invalidateByPattern(pattern: string): number {
    const keys = cache.keys().filter(k => k.includes(pattern))
    keys.forEach(k => cache.del(k))
    logger.info({ message: 'Cache invalidated', pattern, count: keys.length })
    return keys.length
}

/**
 * Invalidates cache for a specific user
 * @param userUuid - User UUID
 * @param endpoint - Optional endpoint filter
 * @returns Number of invalidated keys
 */
export function invalidateUserCache(userUuid: string, endpoint?: string): number {
    const pattern = endpoint ? `${endpoint}:${userUuid}` : userUuid
    return invalidateByPattern(pattern)
}

// ============================================================================
// Cache Statistics & Monitoring
// ============================================================================

/**
 * Returns cache hit/miss statistics
 */
export function getCacheStats() {
    const total = hits + misses
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00'

    return {
        hits,
        misses,
        total,
        hitRate: `${hitRate}%`,
        keys: cache.keys().length,
        stats: cache.getStats(),
    }
}

/**
 * Resets cache statistics
 */
export function resetCacheStats(): void {
    hits = 0
    misses = 0
}

/**
 * Clears all cache entries and resets stats
 */
export function clearCache(): void {
    cache.flushAll()
    resetCacheStats()
    logger.info({ message: 'Cache cleared' })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wraps a function with caching logic
 * @param key - Cache key
 * @param ttl - TTL in seconds
 * @param fn - Function to execute on cache miss
 * @returns Cached or fresh result
 */
export async function withCache<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>
): Promise<T> {
    // Try cache first
    const cached = await getCache<T>(key)
    if (cached !== null) {
        return cached
    }

    // Cache miss - execute function
    const result = await fn()

    // Store in cache
    await setCache(key, result, ttl)

    return result
}
