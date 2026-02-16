import * as yup from 'yup'
import { validateRegexPattern } from '../services/redactionService'

// ============================================================================
// UUID Validators
// ============================================================================

/**
 * Validates UUID format for path parameters
 */
export const uuidSchema = yup.string()
    .uuid('Invalid UUID format')
    .required('UUID is required')

/**
 * Validates share token format
 */
export const shareTokenSchema = yup.string()
    .matches(/^[a-zA-Z0-9\-_]{32,64}$/, 'Invalid share token format')
    .required('Share token is required')

// ============================================================================
// Common Field Validators
// ============================================================================

/**
 * Validates session ID (alphanumeric with hyphens)
 */
export const sessionIdSchema = yup.string()
    .max(100, 'Session ID too long')
    .matches(/^[a-zA-Z0-9\-_]+$/, 'Invalid characters in session ID')

/**
 * Validates model name
 */
export const modelNameSchema = yup.string()
    .max(100, 'Model name too long')
    .trim()

/**
 * Validates provider name
 */
export const providerNameSchema = yup.string()
    .max(50, 'Provider name too long')
    .oneOf(['anthropic', 'openai', 'google'], 'Invalid provider')
    .trim()

/**
 * Validates search query string
 */
export const searchQuerySchema = yup.string()
    .max(500, 'Search query too long')
    .trim()

/**
 * Validates pagination limit
 */
export const paginationLimitSchema = yup.number()
    .integer('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Maximum 100 results per request')

/**
 * Validates pagination offset
 */
export const paginationOffsetSchema = yup.number()
    .integer('Offset must be an integer')
    .min(0, 'Offset cannot be negative')

/**
 * Validates date range ensuring end_date >= start_date
 */
export const dateRangeSchema = yup.object({
    start_date: yup.date()
        .max(new Date(), 'Cannot query future dates')
        .optional(),
    end_date: yup.date()
        .when('start_date', {
            is: (val: any) => val !== undefined && val !== null,
            then: (schema) => schema.min(yup.ref('start_date'), 'End date must be after start date'),
            otherwise: (schema) => schema.optional()
        })
        .optional()
})

// ============================================================================
// Redaction Validators
// ============================================================================

/**
 * Validates redaction rule name
 */
export const ruleNameSchema = yup.string()
    .required('Rule name is required')
    .min(3, 'Rule name must be at least 3 characters')
    .max(100, 'Rule name too long')
    .matches(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid characters in rule name')
    .trim()

/**
 * Validates redaction pattern with ReDoS protection
 */
export const redactionPatternSchema = yup.string()
    .required('Pattern is required')
    .max(500, 'Pattern too long')
    .test('regex-safety', 'Unsafe regex pattern detected', (value) => {
        if (!value) return true
        const validationError = validateRegexPattern(value)
        return validationError === null // Return true if no error, false otherwise
    })

/**
 * Validates target fields for redaction
 */
export const targetFieldsSchema = yup.array()
    .of(yup.string().oneOf([
        'request_data',
        'response_data',
        'tool_input',
        'tool_output',
        'system_prompt',
        'environment',
        'metadata'
    ], 'Invalid target field'))
    .min(1, 'At least one target field required')

// ============================================================================
// Sort & Filter Validators
// ============================================================================

/**
 * Validates sort direction
 */
export const sortDirectionSchema = yup.string()
    .oneOf(['asc', 'desc'], 'Invalid sort direction')

/**
 * Creates a sort column validator with allowed values
 */
export function createSortColumnSchema(allowedColumns: string[]) {
    return yup.string()
        .oneOf(allowedColumns, `Sort column must be one of: ${allowedColumns.join(', ')}`)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitizes string input by trimming and removing potential injection chars
 */
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets to prevent XSS
        .slice(0, 1000) // Hard limit on length
}

/**
 * Validates and sanitizes UUID from path parameter
 */
export async function validateUuidParam(uuid: string): Promise<string> {
    try {
        await uuidSchema.validate(uuid)
        return uuid
    } catch (error: any) {
        throw new Error(`Invalid UUID parameter: ${error.message}`)
    }
}
