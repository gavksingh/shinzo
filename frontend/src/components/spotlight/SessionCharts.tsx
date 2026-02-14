import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { Flex, Text, Card, Grid, Spinner, Badge, Box, Button, Tooltip } from '@radix-ui/themes'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionSummary {
    total_sessions: number
    error_sessions: number
    error_rate: number
    avg_duration_seconds: number
    total_interactions: number
    sessions_24h: number
    sessions_7d: number
    sessions_30d: number
    top_models: Array<{ model: string; usage_count: number; session_count: number }>
    top_providers: Array<{ provider: string; usage_count: number }>
}

interface DailyData {
    date: string
    session_count: number
    error_count: number
    interaction_count: number
}

interface ModelBreakdown {
    model: string
    usage_count: number
    total_input_tokens: number
    total_output_tokens: number
}

interface TimeSeriesData {
    days: number
    daily: DailyData[]
    model_breakdown: ModelBreakdown[]
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const CHART_COLORS = [
    'var(--accent-9)',
    'var(--blue-9)',
    'var(--green-9)',
    'var(--orange-9)',
    'var(--purple-9)',
    'var(--pink-9)',
    'var(--teal-9)',
    'var(--yellow-9)',
]

const PIE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '—'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
}

function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Dashboard Summary Cards ─────────────────────────────────────────────────

export const SessionSummaryCards: React.FC = () => {
    const { token } = useAuth()

    const { data: summary, isLoading } = useQuery<SessionSummary>(
        'session-analytics-summary',
        async () => {
            const response = await axios.get(`${BACKEND_URL}/spotlight/analytics/sessions/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            return response.data
        },
        { retry: false, refetchInterval: 30000, enabled: !!token }
    )

    if (isLoading) {
        return (
            <Card>
                <Flex align="center" justify="center" style={{ padding: '24px' }}>
                    <Spinner size="2" />
                    <Text size="2" color="gray" style={{ marginLeft: '8px' }}>Loading summary...</Text>
                </Flex>
            </Card>
        )
    }

    if (!summary) return null

    return (
        <Flex direction="column" gap="3">
            <Grid columns={{ initial: '2', sm: '4' }} gap="3">
                {/* Total Sessions */}
                <Card style={{ position: 'relative', overflow: 'hidden' }}>
                    <Box style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: 'linear-gradient(90deg, var(--accent-9), var(--accent-7))'
                    }} />
                    <Flex direction="column" gap="1" style={{ padding: '4px 0' }}>
                        <Text size="1" color="gray" weight="medium">Total Sessions</Text>
                        <Text size="6" weight="bold">{summary.total_sessions.toLocaleString()}</Text>
                        <Flex gap="2" align="center">
                            <Badge size="1" color="blue">{summary.sessions_24h} today</Badge>
                            <Badge size="1" variant="outline" color="gray">{summary.sessions_7d} this week</Badge>
                        </Flex>
                    </Flex>
                </Card>

                {/* Error Rate */}
                <Card style={{ position: 'relative', overflow: 'hidden' }}>
                    <Box style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: summary.error_rate > 20
                            ? 'linear-gradient(90deg, var(--red-9), var(--red-7))'
                            : summary.error_rate > 5
                                ? 'linear-gradient(90deg, var(--orange-9), var(--orange-7))'
                                : 'linear-gradient(90deg, var(--green-9), var(--green-7))'
                    }} />
                    <Flex direction="column" gap="1" style={{ padding: '4px 0' }}>
                        <Text size="1" color="gray" weight="medium">Error Rate</Text>
                        <Text size="6" weight="bold" color={summary.error_rate > 20 ? 'red' : summary.error_rate > 5 ? 'orange' : 'green'}>
                            {summary.error_rate}%
                        </Text>
                        <Text size="1" color="gray">
                            {summary.error_sessions} of {summary.total_sessions} sessions
                        </Text>
                    </Flex>
                </Card>

                {/* Avg Duration */}
                <Card style={{ position: 'relative', overflow: 'hidden' }}>
                    <Box style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: 'linear-gradient(90deg, var(--blue-9), var(--blue-7))'
                    }} />
                    <Flex direction="column" gap="1" style={{ padding: '4px 0' }}>
                        <Text size="1" color="gray" weight="medium">Avg Duration</Text>
                        <Text size="6" weight="bold">{formatDuration(summary.avg_duration_seconds)}</Text>
                        <Text size="1" color="gray">
                            {summary.total_interactions.toLocaleString()} total completions
                        </Text>
                    </Flex>
                </Card>

                {/* Top Model */}
                <Card style={{ position: 'relative', overflow: 'hidden' }}>
                    <Box style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                        background: 'linear-gradient(90deg, var(--purple-9), var(--purple-7))'
                    }} />
                    <Flex direction="column" gap="1" style={{ padding: '4px 0' }}>
                        <Text size="1" color="gray" weight="medium">Top Model</Text>
                        {summary.top_models.length > 0 ? (
                            <>
                                <Tooltip content={summary.top_models[0].model}>
                                    <Text size="4" weight="bold" style={{
                                        maxWidth: '100%', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }}>
                                        {summary.top_models[0].model.split('/').pop() || summary.top_models[0].model}
                                    </Text>
                                </Tooltip>
                                <Text size="1" color="gray">
                                    {summary.top_models[0].usage_count.toLocaleString()} calls in {summary.top_models[0].session_count} sessions
                                </Text>
                            </>
                        ) : (
                            <Text size="3" color="gray">No data</Text>
                        )}
                    </Flex>
                </Card>
            </Grid>
        </Flex>
    )
}

// ─── Session Charts ──────────────────────────────────────────────────────────

export const SessionCharts: React.FC = () => {
    const { token } = useAuth()
    const [timeRange, setTimeRange] = useState<number>(30)

    const { data: timeSeries, isLoading } = useQuery<TimeSeriesData>(
        ['session-analytics-timeseries', timeRange],
        async () => {
            const response = await axios.get(`${BACKEND_URL}/spotlight/analytics/sessions/timeseries`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { days: timeRange }
            })
            return response.data
        },
        { retry: false, refetchInterval: 60000, enabled: !!token }
    )

    if (isLoading) {
        return (
            <Card>
                <Flex align="center" justify="center" style={{ padding: '48px' }}>
                    <Spinner size="2" />
                    <Text size="2" color="gray" style={{ marginLeft: '8px' }}>Loading charts...</Text>
                </Flex>
            </Card>
        )
    }

    if (!timeSeries || timeSeries.daily.length === 0) {
        return (
            <Card>
                <Flex direction="column" align="center" justify="center" style={{ padding: '48px' }}>
                    <Text size="3" color="gray">No chart data available</Text>
                    <Text size="2" color="gray">Start using Spotlight to see analytics</Text>
                </Flex>
            </Card>
        )
    }

    const chartData = timeSeries.daily.map(d => ({
        ...d,
        label: formatDateLabel(d.date),
    }))

    const pieData = timeSeries.model_breakdown.map((m, i) => ({
        name: m.model.split('/').pop() || m.model,
        fullName: m.model,
        value: m.usage_count,
        fill: PIE_COLORS[i % PIE_COLORS.length],
    }))

    return (
        <Flex direction="column" gap="4">
            {/* Time range selector */}
            <Flex justify="between" align="center">
                <Text size="4" weight="bold">Session Trends</Text>
                <Flex gap="2">
                    {[7, 14, 30, 60].map(days => (
                        <Button
                            key={days}
                            size="1"
                            variant={timeRange === days ? 'solid' : 'outline'}
                            color={timeRange === days ? undefined : 'gray'}
                            onClick={() => setTimeRange(days)}
                            style={{ cursor: 'pointer' }}
                        >
                            {days}d
                        </Button>
                    ))}
                </Flex>
            </Flex>

            <Grid columns={{ initial: '1', md: '2' }} gap="4">
                {/* Sessions & Errors Area Chart */}
                <Card>
                    <Text size="3" weight="bold" style={{ marginBottom: '12px', display: 'block' }}>
                        Sessions Over Time
                    </Text>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-9)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--accent-9)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <RechartsTooltip
                                contentStyle={{
                                    background: 'var(--gray-2)',
                                    border: '1px solid var(--gray-6)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Area
                                type="monotone"
                                dataKey="session_count"
                                name="Sessions"
                                stroke="var(--accent-9)"
                                fill="url(#sessionGradient)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="error_count"
                                name="Errors"
                                stroke="#ef4444"
                                fill="url(#errorGradient)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* Interactions Bar Chart */}
                <Card>
                    <Text size="3" weight="bold" style={{ marginBottom: '12px', display: 'block' }}>
                        Daily Completions
                    </Text>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <RechartsTooltip
                                contentStyle={{
                                    background: 'var(--gray-2)',
                                    border: '1px solid var(--gray-6)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                            />
                            <Bar
                                dataKey="interaction_count"
                                name="Completions"
                                fill="var(--blue-9)"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </Grid>

            {/* Model Usage Breakdown */}
            {pieData.length > 0 && (
                <Card>
                    <Text size="3" weight="bold" style={{ marginBottom: '12px', display: 'block' }}>
                        Model Usage Breakdown
                    </Text>
                    <Grid columns={{ initial: '1', md: '2' }} gap="4" align="center">
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{
                                        background: 'var(--gray-2)',
                                        border: '1px solid var(--gray-6)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value: number, _: string, props: any) => [
                                        `${value} calls`,
                                        props.payload.fullName || props.payload.name
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <Flex direction="column" gap="2">
                            {timeSeries.model_breakdown.map((m, i) => (
                                <Flex key={m.model} align="center" gap="2">
                                    <Box style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0
                                    }} />
                                    <Flex direction="column" gap="0" style={{ minWidth: 0, flex: 1 }}>
                                        <Text size="2" weight="medium" style={{
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {m.model.split('/').pop() || m.model}
                                        </Text>
                                        <Text size="1" color="gray">
                                            {m.usage_count.toLocaleString()} calls · {Number(m.total_input_tokens).toLocaleString()} in · {Number(m.total_output_tokens).toLocaleString()} out
                                        </Text>
                                    </Flex>
                                </Flex>
                            ))}
                        </Flex>
                    </Grid>
                </Card>
            )}
        </Flex>
    )
}
