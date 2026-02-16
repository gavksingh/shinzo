import React, { useMemo, useState } from 'react'
import { Flex, Text, Badge, Box, Card, Button, Select } from '@radix-ui/themes'
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons'
import { format, formatDistanceToNow } from 'date-fns'

type EventType = 'interaction_start' | 'interaction_end' | 'tool_call' | 'error'
type FilterType = 'all' | 'requests' | 'errors' | 'tools'

interface TimelineEvent {
  timestamp: Date
  type: EventType
  title: string
  details: string
  interactionUuid: string
  duration_ms?: number
}

interface InteractionGroup {
  interactionUuid: string
  model: string
  status: string
  startTime: Date
  endTime: Date | null
  duration_ms: number
  inputTokens: number
  outputTokens: number
  events: TimelineEvent[]
  hasErrors: boolean
  toolCount: number
}

interface SessionTimelineProps {
  interactions: any[]
  onEventClick: (interactionUuid: string) => void
  selectedInteractionUuid?: string | null
}

const EVENT_COLORS: Record<EventType, 'blue' | 'green' | 'purple' | 'red'> = {
  interaction_start: 'blue',
  interaction_end: 'green',
  tool_call: 'purple',
  error: 'red'
}

const EVENT_LABELS: Record<EventType, string> = {
  interaction_start: 'Request',
  interaction_end: 'Response',
  tool_call: 'Tool Call',
  error: 'Error'
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  interactions,
  onEventClick,
  selectedInteractionUuid
}) => {
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  // Build timeline events from interactions
  const allEvents = useMemo(() => {
    const timelineEvents: TimelineEvent[] = []

    interactions.forEach(interaction => {
      timelineEvents.push({
        timestamp: new Date(interaction.request_timestamp),
        type: 'interaction_start',
        title: `${interaction.model} request`,
        details: `${interaction.input_tokens?.toLocaleString() || 0} input tokens`,
        interactionUuid: interaction.uuid
      })

      interaction.tool_usages?.forEach((tool: any) => {
        timelineEvents.push({
          timestamp: new Date(interaction.request_timestamp),
          type: 'tool_call',
          title: `Tool: ${tool.tool_name}`,
          details: 'Tool executed',
          interactionUuid: interaction.uuid
        })
      })

      if (interaction.status === 'error') {
        timelineEvents.push({
          timestamp: new Date(interaction.response_timestamp || interaction.request_timestamp),
          type: 'error',
          title: `Error: ${interaction.error_type || 'Unknown'}`,
          details: interaction.error_message || 'Unknown error',
          interactionUuid: interaction.uuid
        })
      }

      if (interaction.response_timestamp) {
        timelineEvents.push({
          timestamp: new Date(interaction.response_timestamp),
          type: 'interaction_end',
          title: 'Response received',
          details: `${interaction.output_tokens?.toLocaleString() || 0} output tokens (${interaction.latency_ms}ms)`,
          interactionUuid: interaction.uuid,
          duration_ms: interaction.latency_ms
        })
      }
    })

    return timelineEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [interactions])

  // Compute counts for filter badges
  const counts = useMemo(() => ({
    all: allEvents.length,
    requests: allEvents.filter(e => e.type === 'interaction_start').length,
    errors: allEvents.filter(e => e.type === 'error').length,
    tools: allEvents.filter(e => e.type === 'tool_call').length
  }), [allEvents])

  // Group events by interaction for zoom/collapse
  const groups = useMemo((): InteractionGroup[] => {
    const groupMap = new Map<string, InteractionGroup>()

    interactions.forEach(interaction => {
      const events = allEvents.filter(e => e.interactionUuid === interaction.uuid)
      groupMap.set(interaction.uuid, {
        interactionUuid: interaction.uuid,
        model: interaction.model,
        status: interaction.status,
        startTime: new Date(interaction.request_timestamp),
        endTime: interaction.response_timestamp ? new Date(interaction.response_timestamp) : null,
        duration_ms: interaction.latency_ms || 0,
        inputTokens: interaction.input_tokens || 0,
        outputTokens: interaction.output_tokens || 0,
        events,
        hasErrors: interaction.status === 'error',
        toolCount: interaction.tool_usages?.length || 0
      })
    })

    return Array.from(groupMap.values()).sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    )
  }, [interactions, allEvents])

  // Apply filter
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groups
    return groups.filter(group => {
      switch (filter) {
        case 'requests': return true // Always show the group header
        case 'errors': return group.hasErrors
        case 'tools': return group.toolCount > 0
        default: return true
      }
    })
  }, [groups, filter])

  const filterEvents = (events: TimelineEvent[]): TimelineEvent[] => {
    if (filter === 'all') return events
    switch (filter) {
      case 'requests': return events.filter(e => e.type === 'interaction_start' || e.type === 'interaction_end')
      case 'errors': return events.filter(e => e.type === 'error' || e.type === 'interaction_start')
      case 'tools': return events.filter(e => e.type === 'tool_call' || e.type === 'interaction_start')
      default: return events
    }
  }

  const toggleGroup = (uuid: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) {
        next.delete(uuid)
      } else {
        next.add(uuid)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    if (allExpanded) {
      setExpandedGroups(new Set())
      setAllExpanded(false)
    } else {
      setExpandedGroups(new Set(groups.map(g => g.interactionUuid)))
      setAllExpanded(true)
    }
  }

  const formatDuration = (ms: number): string => {
    if (ms >= 60000) {
      const minutes = Math.floor(ms / 60000)
      const seconds = ((ms % 60000) / 1000).toFixed(1)
      return `${minutes}m ${seconds}s`
    }
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
    return `${ms}ms`
  }

  if (allEvents.length === 0) {
    return (
      <Card>
        <Flex direction="column" gap="2">
          <Text size="3" weight="bold">Session Timeline</Text>
          <Text size="2" color="gray">No events to display</Text>
        </Flex>
      </Card>
    )
  }

  return (
    <Card>
      <Flex direction="column" gap="3">
        {/* Header with controls */}
        <Flex justify="between" align="center" wrap="wrap" gap="2">
          <Text size="3" weight="bold">Session Timeline</Text>

          <Flex gap="2" align="center">
            {/* Filter dropdown */}
            <Select.Root value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <Select.Trigger variant="soft" />
              <Select.Content>
                <Select.Item value="all">All Events ({filteredGroups.length} interactions)</Select.Item>
                <Select.Item value="requests">Requests ({counts.requests})</Select.Item>
                <Select.Item value="errors">Errors ({counts.errors})</Select.Item>
                <Select.Item value="tools">Tool Calls ({counts.tools})</Select.Item>
              </Select.Content>
            </Select.Root>

            {/* Expand/Collapse All */}
            <Button variant="soft" size="1" onClick={handleExpandAll}>
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </Flex>
        </Flex>

        {/* Timeline content */}
        <Box style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical timeline line */}
          <Box
            style={{
              position: 'absolute',
              left: '10px',
              top: '0',
              bottom: '0',
              width: '2px',
              background: 'var(--gray-6)'
            }}
          />

          {/* Interaction groups */}
          <Flex direction="column" gap="2">
            {filteredGroups.map((group, groupIdx) => {
              const isExpanded = expandedGroups.has(group.interactionUuid)
              const isSelected = selectedInteractionUuid === group.interactionUuid
              const filteredEvents = filterEvents(group.events)

              return (
                <Box key={group.interactionUuid}>
                  {/* Group header (collapsed summary) */}
                  <Flex
                    gap="3"
                    align="center"
                    p="2"
                    style={{
                      cursor: 'pointer',
                      position: 'relative',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--blue-3)' : 'transparent',
                      border: isSelected ? '1px solid var(--blue-6)' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => {
                      toggleGroup(group.interactionUuid)
                      onEventClick(group.interactionUuid)
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--gray-3)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Timeline dot */}
                    <Box
                      style={{
                        position: 'absolute',
                        left: '-21px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: group.hasErrors
                          ? 'var(--red-9)'
                          : `var(--blue-9)`,
                        border: isSelected ? '3px solid var(--blue-11)' : '2px solid var(--gray-1)',
                        flexShrink: 0,
                        zIndex: 1
                      }}
                    />

                    {/* Expand/collapse chevron */}
                    <Box style={{ flexShrink: 0 }}>
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </Box>

                    {/* Group summary */}
                    <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                      <Flex gap="2" align="center" wrap="wrap">
                        <Text size="2" weight="bold" style={{ fontFamily: 'monospace' }}>
                          #{groupIdx + 1}
                        </Text>
                        <Badge>{group.model}</Badge>
                        <Badge color={group.status === 'success' ? 'green' : 'red'}>
                          {group.status}
                        </Badge>
                        {group.toolCount > 0 && (
                          <Badge color="purple" variant="soft">
                            {group.toolCount} tool{group.toolCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {group.duration_ms > 0 && (
                          <Text size="1" color="gray">{formatDuration(group.duration_ms)}</Text>
                        )}
                      </Flex>
                      <Flex gap="3">
                        <Text size="1" color="gray">
                          {format(group.startTime, 'HH:mm:ss.SSS')}
                        </Text>
                        <Text size="1" color="gray">
                          {group.inputTokens.toLocaleString()} in → {group.outputTokens.toLocaleString()} out
                        </Text>
                        <Text size="1" color="gray" style={{ opacity: 0.7 }}>
                          {formatDistanceToNow(group.startTime, { addSuffix: true })}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>

                  {/* Expanded events */}
                  {isExpanded && filteredEvents.length > 0 && (
                    <Box style={{ marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px dashed var(--gray-5)' }}>
                      <Flex direction="column" gap="1" py="1">
                        {filteredEvents.map((event, idx) => (
                          <Flex
                            key={idx}
                            gap="2"
                            align="center"
                            p="1"
                            style={{
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'background 0.1s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEventClick(event.interactionUuid)
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Small dot */}
                            <Box
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: `var(--${EVENT_COLORS[event.type]}-9)`,
                                flexShrink: 0
                              }}
                            />
                            <Badge size="1" color={EVENT_COLORS[event.type]} variant="soft">
                              {EVENT_LABELS[event.type]}
                            </Badge>
                            <Text size="1" weight="medium" style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0
                            }}>
                              {event.title}
                            </Text>
                            <Text size="1" color="gray" style={{ flexShrink: 0 }}>
                              {event.details}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Flex>
        </Box>

        {/* Filter empty state */}
        {filteredGroups.length === 0 && (
          <Flex direction="column" align="center" py="4">
            <Text size="2" color="gray">No events match the selected filter</Text>
          </Flex>
        )}
      </Flex>
    </Card>
  )
}
