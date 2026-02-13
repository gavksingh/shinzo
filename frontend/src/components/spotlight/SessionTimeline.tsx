import React, { useMemo } from 'react'
import { Flex, Text, Badge, Box, Card } from '@radix-ui/themes'
import { formatDistanceToNow } from 'date-fns'

interface TimelineEvent {
  timestamp: Date
  type: 'interaction_start' | 'interaction_end' | 'tool_call' | 'error'
  title: string
  details: string
  interactionUuid: string
  duration_ms?: number
}

interface SessionTimelineProps {
  interactions: any[]
  onEventClick: (interactionUuid: string) => void
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  interactions,
  onEventClick
}) => {
  const events = useMemo(() => {
    const timelineEvents: TimelineEvent[] = []

    interactions.forEach(interaction => {
      // Interaction start event
      timelineEvents.push({
        timestamp: new Date(interaction.request_timestamp),
        type: 'interaction_start',
        title: `${interaction.model} request`,
        details: `${interaction.input_tokens} input tokens`,
        interactionUuid: interaction.uuid
      })

      // Tool call events
      interaction.tool_usages?.forEach((tool: any) => {
        timelineEvents.push({
          timestamp: new Date(interaction.request_timestamp),
          type: 'tool_call',
          title: `Tool: ${tool.tool_name}`,
          details: 'Tool executed',
          interactionUuid: interaction.uuid
        })
      })

      // Error events
      if (interaction.status === 'error') {
        timelineEvents.push({
          timestamp: new Date(interaction.response_timestamp || interaction.request_timestamp),
          type: 'error',
          title: `Error: ${interaction.error_type}`,
          details: interaction.error_message || 'Unknown error',
          interactionUuid: interaction.uuid
        })
      }

      // Interaction end event
      if (interaction.response_timestamp) {
        timelineEvents.push({
          timestamp: new Date(interaction.response_timestamp),
          type: 'interaction_end',
          title: 'Response received',
          details: `${interaction.output_tokens} output tokens (${interaction.latency_ms}ms)`,
          interactionUuid: interaction.uuid,
          duration_ms: interaction.latency_ms
        })
      }
    })

    return timelineEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [interactions])

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'interaction_start': return 'blue'
      case 'interaction_end': return 'green'
      case 'tool_call': return 'purple'
      case 'error': return 'red'
      default: return 'gray'
    }
  }

  if (events.length === 0) {
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
      <Flex direction="column" gap="2">
        <Text size="3" weight="bold">Session Timeline</Text>
        <Box style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Timeline line */}
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

          {/* Events */}
          <Flex direction="column" gap="3">
            {events.map((event, idx) => (
              <Flex
                key={idx}
                gap="3"
                align="start"
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => onEventClick(event.interactionUuid)}
              >
                {/* Event marker - positioned on the timeline line */}
                <Box
                  style={{
                    position: 'absolute',
                    left: '-21px',
                    top: '4px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: `var(--${getEventColor(event.type)}-9)`,
                    border: '2px solid var(--gray-1)',
                    flexShrink: 0,
                    zIndex: 1
                  }}
                />

                {/* Event content */}
                <Flex direction="column" gap="1" style={{ flex: 1, paddingLeft: '4px' }}>
                  <Flex gap="2" align="center">
                    <Badge color={getEventColor(event.type)}>{event.type}</Badge>
                    <Text size="2" weight="medium">{event.title}</Text>
                  </Flex>
                  <Text size="1" color="gray">{event.details}</Text>
                  <Text size="1" color="gray">
                    {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Box>
      </Flex>
    </Card>
  )
}
