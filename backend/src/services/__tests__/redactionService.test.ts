import { validateRegexPattern, applyRedaction, convertSessionToCSV } from '../redactionService'

describe('RedactionService', () => {
    describe('validateRegexPattern', () => {
        it('should accept valid simple patterns', () => {
            const result = validateRegexPattern('[a-zA-Z0-9]+')
            expect(result.valid).toBe(true)
        })

        it('should accept email pattern', () => {
            const result = validateRegexPattern('[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}')
            expect(result.valid).toBe(true)
        })

        it('should reject patterns that are too long', () => {
            const longPattern = 'a'.repeat(501)
            const result = validateRegexPattern(longPattern)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('too long')
        })

        it('should reject nested quantifiers (a+)+', () => {
            const result = validateRegexPattern('(a+)+')
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('nested quantifiers')
        })

        it('should reject nested quantifiers (a*)*', () => {
            const result = validateRegexPattern('(a*)*')
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('nested quantifiers')
        })

        it('should reject mixed quantifiers (a+)*', () => {
            const result = validateRegexPattern('(a+)*')
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('nested quantifiers')
        })

        it('should reject excessive alternations', () => {
            const pattern = 'a|b|c|d|e|f|g|h|i|j|k|l'
            const result = validateRegexPattern(pattern)
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('alternations')
        })

        it('should reject invalid regex syntax', () => {
            const result = validateRegexPattern('[invalid')
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('Invalid regex pattern')
        })
    })

    describe('applyRedaction', () => {
        const mockRules = [
            {
                pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
                replacement: '[EMAIL]',
                target_fields: ['request_data', 'response_data']
            },
            {
                pattern: '\\d{3}-\\d{2}-\\d{4}',
                replacement: '[SSN]',
                target_fields: ['request_data', 'response_data']
            }
        ]

        it('should redact email addresses in interaction request_data', () => {
            const data = {
                interactions: [
                    {
                        request_data: {
                            message: 'Contact me at john@example.com'
                        }
                    }
                ]
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.interactions[0].request_data.message).toBe('Contact me at [EMAIL]')
        })

        it('should redact SSN in interaction request_data', () => {
            const data = {
                interactions: [
                    {
                        request_data: {
                            ssn: '123-45-6789'
                        }
                    }
                ]
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.interactions[0].request_data.ssn).toBe('[SSN]')
        })

        it('should redact nested objects in interactions', () => {
            const data = {
                interactions: [
                    {
                        request_data: {
                            user: {
                                email: 'test@example.com',
                                ssn: '111-22-3333'
                            }
                        }
                    }
                ]
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.interactions[0].request_data.user.email).toBe('[EMAIL]')
            expect(redacted.interactions[0].request_data.user.ssn).toBe('[SSN]')
        })

        it('should redact arrays in interactions', () => {
            const data = {
                interactions: [
                    {
                        request_data: {
                            emails: ['alice@example.com', 'bob@example.com']
                        }
                    }
                ]
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.interactions[0].request_data.emails).toEqual(['[EMAIL]', '[EMAIL]'])
        })

        it('should redact interaction data', () => {
            const data = {
                interactions: [
                    {
                        request_data: { email: 'test@example.com' },
                        response_data: { contact: 'admin@example.com' }
                    }
                ]
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.interactions[0].request_data.email).toBe('[EMAIL]')
            expect(redacted.interactions[0].response_data.contact).toBe('[EMAIL]')
        })

        it('should redact tool usage data', () => {
            const toolRules = [
                {
                    pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
                    replacement: '[EMAIL]',
                    target_fields: ['tool_input', 'tool_output']
                }
            ]

            const data = {
                interactions: [
                    {
                        toolUsages: [
                            {
                                tool_input: { email: 'user@example.com' },
                                tool_output: { result: 'sent to admin@example.com' }
                            }
                        ]
                    }
                ]
            }

            const redacted = applyRedaction(data, toolRules)
            expect(redacted.interactions[0].toolUsages[0].tool_input.email).toBe('[EMAIL]')
            expect(redacted.interactions[0].toolUsages[0].tool_output.result).toBe('sent to [EMAIL]')
        })

        it('should not modify data when no rules provided', () => {
            const data = {
                request_data: { email: 'test@example.com' },
                interactions: []
            }

            const redacted = applyRedaction(data, [])
            expect(redacted.request_data.email).toBe('test@example.com')
        })

        it('should handle null and undefined values', () => {
            const data = {
                request_data: null,
                metadata: undefined,
                interactions: []
            }

            const redacted = applyRedaction(data, mockRules)
            expect(redacted.request_data).toBeNull()
            expect(redacted.metadata).toBeUndefined()
        })
    })

    describe('convertSessionToCSV', () => {
        it('should generate valid CSV with headers', () => {
            const sessionData = {
                session_id: 'test-session',
                interactions: []
            }

            const csv = convertSessionToCSV(sessionData)
            expect(csv).toContain('interaction_uuid,request_timestamp,response_timestamp')
            expect(csv).toContain('# Session: test-session')
        })

        it('should include interaction data in CSV', () => {
            const sessionData = {
                session_id: 'test-session',
                interactions: [
                    {
                        uuid: 'interaction-1',
                        request_timestamp: '2024-01-01T00:00:00Z',
                        response_timestamp: '2024-01-01T00:00:01Z',
                        model: 'claude-3',
                        provider: 'anthropic',
                        input_tokens: 100,
                        output_tokens: 50,
                        cache_read_input_tokens: 0,
                        latency_ms: 1000,
                        status: 'success',
                        error_type: null,
                        error_message: null
                    }
                ]
            }

            const csv = convertSessionToCSV(sessionData)
            expect(csv).toContain('interaction-1')
            expect(csv).toContain('claude-3')
            expect(csv).toContain('anthropic')
            expect(csv).toContain('100')
            expect(csv).toContain('50')
        })

        it('should escape special characters in CSV', () => {
            const sessionData = {
                interactions: [
                    {
                        uuid: 'test',
                        error_message: 'Error: "Something went wrong", please retry',
                        status: 'error'
                    }
                ]
            }

            const csv = convertSessionToCSV(sessionData)
            expect(csv).toContain('"Error: ""Something went wrong"", please retry"')
        })

        it('should handle empty sessions', () => {
            const sessionData = {
                interactions: []
            }

            const csv = convertSessionToCSV(sessionData)
            expect(csv).toContain('interaction_uuid')
            // Header row only, no session comment, no data rows
            expect(csv.split('\n').length).toBe(1)
        })

        it('should count tool usages correctly', () => {
            const sessionData = {
                interactions: [
                    {
                        uuid: 'test',
                        toolUsages: [{ tool_name: 'search' }, { tool_name: 'calculate' }]
                    }
                ]
            }

            const csv = convertSessionToCSV(sessionData)
            expect(csv).toContain('2') // tool_count column
        })
    })
})
