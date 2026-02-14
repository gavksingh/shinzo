import React, { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useLocation } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { Button, TextField, Card, Flex, Text, Heading, Select, Box, Tabs, Switch, Badge, Dialog } from '@radix-ui/themes'
import * as Icons from '@radix-ui/react-icons'
import { API_BASE_URL } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { ingestTokenService } from '../backendService'

interface UserProfile {
  id: string
  email: string
  name: string
  organization?: string
  created_at: string
}

interface Settings {
  notifications: {
    email_alerts: boolean
    trace_errors: boolean
    performance_alerts: boolean
    weekly_reports: boolean
  }
  data_retention: {
    traces_days: number
    metrics_days: number
    logs_days: number
  }
  sampling: {
    enabled: boolean
    rate: number
  }
}

interface IngestToken {
  uuid: string
  ingest_token: string
  status: 'live' | 'deprecated'
  created_at: string
  updated_at: string
}

interface RedactionRule {
  uuid: string
  rule_name: string
  rule_type: 'regex' | 'field_name' | 'builtin'
  pattern: string
  replacement: string
  is_enabled: boolean
  is_builtin: boolean
  target_fields: string[]
  created_at: string
  updated_at: string
}

export const SettingsPage: React.FC = () => {
  const auth = useAuth()
  const { token, user, logout } = auth
  const queryClient = useQueryClient()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState('profile')

  // Support URL hash-based tab navigation (e.g., /settings#privacy)
  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash && ['profile', 'accounts', 'tokens', 'privacy'].includes(hash)) {
      setActiveTab(hash)
    }
  }, [location.hash])
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState({
    rule_name: '',
    pattern: '',
    replacement: '[REDACTED]',
    rule_type: 'regex' as 'regex' | 'field_name',
  })

  const { data: profile, isLoading: profileLoading } = useQuery(
    ['profile'],
    async () => {
      const response = await fetch(`${API_BASE_URL}/auth/fetch_user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error('Failed to fetch profile')
      return response.json()
    },
    { enabled: !!token }
  )

  // Stub out settings until backend implements these endpoints
  const settings: Settings = {
    notifications: {
      email_alerts: false,
      trace_errors: true,
      performance_alerts: true,
      weekly_reports: false
    },
    data_retention: {
      traces_days: 30,
      metrics_days: 90,
      logs_days: 7
    },
    sampling: {
      enabled: false,
      rate: 10
    }
  }
  const settingsLoading = false

  const { data: ingestTokens, isLoading: tokensLoading } = useQuery(
    ['ingestTokens'],
    async () => {
      return ingestTokenService.fetchAll(token!)
    },
    { enabled: !!token }
  )

  // Redaction rules
  const { data: redactionRules, isLoading: rulesLoading } = useQuery(
    ['redactionRules'],
    async () => {
      const response = await fetch(`${API_BASE_URL}/spotlight/redaction-rules`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to fetch redaction rules')
      return response.json() as Promise<RedactionRule[]>
    },
    { enabled: !!token }
  )

  const toggleRuleMutation = useMutation(
    async ({ ruleUuid, is_enabled }: { ruleUuid: string; is_enabled: boolean }) => {
      const response = await fetch(`${API_BASE_URL}/spotlight/redaction-rules/${ruleUuid}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled }),
      })
      if (!response.ok) throw new Error('Failed to update rule')
      return response.json()
    },
    { onSuccess: () => queryClient.invalidateQueries(['redactionRules']) }
  )

  const createRuleMutation = useMutation(
    async (data: typeof newRule) => {
      const response = await fetch(`${API_BASE_URL}/spotlight/redaction-rules`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create rule')
      return response.json()
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['redactionRules'])
        setShowAddRule(false)
        setNewRule({ rule_name: '', pattern: '', replacement: '[REDACTED]', rule_type: 'regex' })
      }
    }
  )

  const deleteRuleMutation = useMutation(
    async (ruleUuid: string) => {
      const response = await fetch(`${API_BASE_URL}/spotlight/redaction-rules/${ruleUuid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to delete rule')
      return response.json()
    },
    { onSuccess: () => queryClient.invalidateQueries(['redactionRules']) }
  )

  const { data: authMethods, isLoading: authMethodsLoading } = useQuery(
    ['authMethods'],
    async () => {
      if (!token) return null
      return await auth.fetchAuthMethods()
    },
    { enabled: !!token }
  )

  const { data: oauthAccounts, isLoading: oauthAccountsLoading } = useQuery(
    ['oauthAccounts'],
    async () => {
      if (!token) return []
      return await auth.fetchOAuthAccounts()
    },
    { enabled: !!token }
  )

  // Stub out settings update until backend implements these endpoints
  const updateSettingsMutation = useMutation(
    async (newSettings: Partial<Settings>) => {
      // TODO: Implement settings update when backend adds these endpoints
      console.log('Settings update requested (not yet implemented):', newSettings)
      return { success: true }
    },
    {
      onSuccess: () => {
        // Settings are stubbed, so no need to invalidate queries
        console.log('Settings would be updated in backend')
      },
    }
  )

  // Stub out password change until backend implements this endpoint
  const changePasswordMutation = useMutation(
    async (passwordData: typeof passwordForm) => {
      // TODO: Implement password change when backend adds this endpoint
      console.log('Password change requested (not yet implemented):', { email: passwordData.current_password ? '[REDACTED]' : '' })
      return { success: true }
    },
    {
      onSuccess: () => {
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
        setIsChangingPassword(false)
        console.log('Password would be changed in backend')
      },
    }
  )

  const generateTokenMutation = useMutation(
    async () => {
      return ingestTokenService.generate(token!)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ingestTokens'])
      },
    }
  )

  const revokeTokenMutation = useMutation(
    async (tokenUuid: string) => {
      return ingestTokenService.revoke(token!, tokenUuid)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ingestTokens'])
      },
    }
  )

  const unlinkOAuthMutation = useMutation(
    async (provider: string) => {
      return await auth.unlinkOAuthProvider(provider)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['authMethods'])
        queryClient.invalidateQueries(['oauthAccounts'])
      },
    }
  )

  const handleNotificationChange = (key: string, value: boolean) => {
    if (settings) {
      updateSettingsMutation.mutate({
        notifications: {
          ...settings.notifications,
          [key]: value
        }
      })
    }
  }

  const handleRetentionChange = (key: string, value: number) => {
    if (settings) {
      updateSettingsMutation.mutate({
        data_retention: {
          ...settings.data_retention,
          [key]: value
        }
      })
    }
  }

  const handleSamplingChange = (key: string, value: boolean | number) => {
    if (settings) {
      updateSettingsMutation.mutate({
        sampling: {
          ...settings.sampling,
          [key]: value
        }
      })
    }
  }

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('New passwords do not match')
      return
    }
    changePasswordMutation.mutate(passwordForm)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const isLoading = profileLoading || settingsLoading

  return (
    <AppLayout>
      <Flex direction="column" gap="6">
        <Heading size="6">Settings</Heading>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="profile">
              <Icons.PersonIcon />
              Profile
            </Tabs.Trigger>
            <Tabs.Trigger value="accounts">
              <Icons.Link1Icon />
              Connected Accounts
            </Tabs.Trigger>
            <Tabs.Trigger value="tokens">
              <Icons.TokensIcon />
              Ingest Tokens
            </Tabs.Trigger>
            <Tabs.Trigger value="privacy">
              <Icons.EyeNoneIcon />
              Privacy & Redaction
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="profile">
            <Flex direction="column" gap="6">
              <Card>
                <Flex direction="column" gap="4">
                  <Heading size="4">Profile Information</Heading>

                  {isLoading ? (
                    <Flex direction="column" gap="4">
                      <Box className="animate-pulse">
                        <Box style={{ height: '16px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '33%', marginBottom: '8px' }} />
                        <Box style={{ height: '40px', backgroundColor: 'var(--gray-3)', borderRadius: '4px' }} />
                      </Box>
                      <Box className="animate-pulse">
                        <Box style={{ height: '16px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '33%', marginBottom: '8px' }} />
                        <Box style={{ height: '40px', backgroundColor: 'var(--gray-3)', borderRadius: '4px' }} />
                      </Box>
                    </Flex>
                  ) : (
                    <Flex direction="column" gap="4">
                      <Flex direction="column" gap="2">
                        <Text size="2" weight="medium">Email</Text>
                        <TextField.Root
                          type="email"
                          value={profile?.email || ''}
                          disabled
                          style={{ backgroundColor: 'var(--gray-2)' }}
                        />
                      </Flex>

                    </Flex>
                  )}
                </Flex>
              </Card>


              <Card>
                <Flex direction="column" gap="4">
                  <Heading size="4">Account Actions</Heading>
                  <Button
                    color="red"
                    onClick={logout}
                  >
                    <Icons.ExitIcon />
                    Sign Out
                  </Button>
                </Flex>
              </Card>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="accounts">
            <Flex direction="column" gap="6">
              <Card>
                <Flex direction="column" gap="4">
                  <Heading size="4">Connected Accounts</Heading>
                  <Text size="2" color="gray">
                    Link multiple login methods to your account for convenient access.
                  </Text>

                  {/* Warning if only one auth method remains */}
                  {authMethods && (authMethods.oauthProviders.length + (authMethods.hasPassword ? 1 : 0)) <= 1 && (
                    <Box style={{ backgroundColor: 'var(--yellow-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--yellow-6)' }}>
                      <Flex gap="2" align="start">
                        <Icons.ExclamationTriangleIcon color="var(--yellow-11)" />
                        <Flex direction="column" gap="1">
                          <Text size="2" weight="medium" style={{ color: 'var(--yellow-11)' }}>
                            Only one authentication method
                          </Text>
                          <Text size="2" style={{ color: 'var(--yellow-11)' }}>
                            Add another login method before removing your current one to prevent being locked out.
                          </Text>
                        </Flex>
                      </Flex>
                    </Box>
                  )}

                  {authMethodsLoading || oauthAccountsLoading ? (
                    <Flex direction="column" gap="3">
                      {[1, 2, 3].map(i => (
                        <Box key={i} className="animate-pulse" style={{ padding: '16px', backgroundColor: 'var(--gray-2)', borderRadius: '8px' }}>
                          <Box style={{ height: '16px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '40%' }} />
                        </Box>
                      ))}
                    </Flex>
                  ) : (
                    <Flex direction="column" gap="3">
                      {/* Google Account */}
                      <Card>
                        <Flex justify="between" align="center">
                          <Flex align="center" gap="3">
                            <Box style={{ fontSize: '24px' }}>🔵</Box>
                            <Flex direction="column" gap="1">
                              <Text size="3" weight="medium">Google</Text>
                              {oauthAccounts?.find(a => a.oauth_provider === 'google') ? (
                                <Text size="2" color="gray">
                                  {oauthAccounts.find(a => a.oauth_provider === 'google')?.oauth_email}
                                </Text>
                              ) : (
                                <Text size="2" color="gray">Not connected</Text>
                              )}
                            </Flex>
                          </Flex>
                          {oauthAccounts?.find(a => a.oauth_provider === 'google') ? (
                            <Button
                              size="2"
                              variant="soft"
                              color="red"
                              onClick={() => unlinkOAuthMutation.mutate('google')}
                              disabled={unlinkOAuthMutation.isLoading}
                            >
                              <Icons.Cross2Icon />
                              Disconnect
                            </Button>
                          ) : (
                            <Button
                              size="2"
                              variant="soft"
                              onClick={() => auth.linkOAuthProvider('google', '/settings')}
                            >
                              <Icons.Link1Icon />
                              Connect
                            </Button>
                          )}
                        </Flex>
                      </Card>

                      {/* GitHub Account */}
                      <Card>
                        <Flex justify="between" align="center">
                          <Flex align="center" gap="3">
                            <Box style={{ fontSize: '24px' }}>⚫</Box>
                            <Flex direction="column" gap="1">
                              <Text size="3" weight="medium">GitHub</Text>
                              {oauthAccounts?.find(a => a.oauth_provider === 'github') ? (
                                <Text size="2" color="gray">
                                  {oauthAccounts.find(a => a.oauth_provider === 'github')?.oauth_email}
                                </Text>
                              ) : (
                                <Text size="2" color="gray">Not connected</Text>
                              )}
                            </Flex>
                          </Flex>
                          {oauthAccounts?.find(a => a.oauth_provider === 'github') ? (
                            <Button
                              size="2"
                              variant="soft"
                              color="red"
                              onClick={() => unlinkOAuthMutation.mutate('github')}
                              disabled={unlinkOAuthMutation.isLoading}
                            >
                              <Icons.Cross2Icon />
                              Disconnect
                            </Button>
                          ) : (
                            <Button
                              size="2"
                              variant="soft"
                              onClick={() => auth.linkOAuthProvider('github', '/settings')}
                            >
                              <Icons.Link1Icon />
                              Connect
                            </Button>
                          )}
                        </Flex>
                      </Card>

                      {/* Password */}
                      <Card>
                        <Flex justify="between" align="center">
                          <Flex align="center" gap="3">
                            <Box style={{ fontSize: '24px' }}>🔑</Box>
                            <Flex direction="column" gap="1">
                              <Text size="3" weight="medium">Password</Text>
                              {authMethods?.hasPassword ? (
                                <Text size="2" color="gray">Password is set</Text>
                              ) : (
                                <Text size="2" color="gray">No password set</Text>
                              )}
                            </Flex>
                          </Flex>
                          <Button
                            size="2"
                            variant="soft"
                            disabled
                          >
                            {authMethods?.hasPassword ? 'Change Password' : 'Set Password'}
                          </Button>
                        </Flex>
                      </Card>
                    </Flex>
                  )}
                </Flex>
              </Card>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="tokens">
            <Card>
              <Flex direction="column" gap="4">
                <Flex justify="between" align="center">
                  <Heading size="4">Ingest Tokens</Heading>
                  <Button
                    onClick={() => generateTokenMutation.mutate()}
                    disabled={generateTokenMutation.isLoading}
                  >
                    <Icons.PlusIcon />
                    {generateTokenMutation.isLoading ? 'Generating...' : 'Generate New Token'}
                  </Button>
                </Flex>

                <Text size="2" color="gray">
                  Ingest tokens are used to authenticate your applications when sending telemetry data to Shinzo.
                </Text>

                {tokensLoading ? (
                  <Flex direction="column" gap="4">
                    {[1, 2].map(i => (
                      <Box key={i} className="animate-pulse" style={{ padding: '16px', backgroundColor: 'var(--gray-2)', borderRadius: '8px' }}>
                        <Box style={{ height: '16px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '60%', marginBottom: '8px' }} />
                        <Box style={{ height: '12px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '40%' }} />
                      </Box>
                    ))}
                  </Flex>
                ) : ingestTokens && ingestTokens.length > 0 ? (
                  <Flex direction="column" gap="3">
                    {ingestTokens.map((token: IngestToken) => (
                      <Card key={token.uuid} style={{ backgroundColor: token.status === 'live' ? 'var(--green-2)' : 'var(--gray-3)' }}>
                        <Flex direction="column" gap="3">
                          <Flex justify="between" align="center">
                            <Flex direction="column" gap="1">
                              <Flex align="center" gap="2">
                                <Text size="2" weight="medium">
                                  {token.status === 'live' ? '🟢' : '🔴'}
                                  {token.status === 'live' ? 'Active Token' : 'Deprecated Token'}
                                </Text>
                                {token.status === 'live' && (
                                  <Text size="1" style={{ backgroundColor: 'var(--green-9)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                                    LIVE
                                  </Text>
                                )}
                              </Flex>
                              <Text size="1" color="gray">
                                Created: {new Date(token.created_at).toLocaleDateString()}
                              </Text>
                            </Flex>
                            <Flex gap="2">
                              <Button
                                size="1"
                                variant="ghost"
                                onClick={() => copyToClipboard(token.ingest_token)}
                              >
                                <Icons.CopyIcon />
                                Copy
                              </Button>
                              {token.status === 'live' && (
                                <Button
                                  size="1"
                                  color="red"
                                  variant="ghost"
                                  onClick={() => revokeTokenMutation.mutate(token.uuid)}
                                  disabled={revokeTokenMutation.isLoading}
                                >
                                  <Icons.TrashIcon />
                                  Revoke
                                </Button>
                              )}
                            </Flex>
                          </Flex>
                          <Box style={{ backgroundColor: 'var(--gray-1)', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                            {token.ingest_token}
                          </Box>
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                ) : (
                  <Box style={{ textAlign: 'center', padding: '32px' }}>
                    <Text size="3" color="gray">No ingest tokens found</Text>
                    <br />
                    <Text size="2" color="gray">Generate your first token to start sending telemetry data</Text>
                  </Box>
                )}
              </Flex>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="privacy">
            <Flex direction="column" gap="6">
              <Card>
                <Flex direction="column" gap="4">
                  <Flex justify="between" align="center">
                    <Flex direction="column" gap="1">
                      <Heading size="4">Privacy & Redaction Rules</Heading>
                      <Text size="2" color="gray">
                        Configure patterns to automatically redact sensitive data from session exports and shared sessions.
                      </Text>
                    </Flex>
                    <Button onClick={() => setShowAddRule(true)}>
                      <Icons.PlusIcon />
                      Add Custom Rule
                    </Button>
                  </Flex>

                  {rulesLoading ? (
                    <Flex direction="column" gap="3">
                      {[1, 2, 3].map(i => (
                        <Box key={i} className="animate-pulse" style={{ padding: '16px', backgroundColor: 'var(--gray-2)', borderRadius: '8px' }}>
                          <Box style={{ height: '16px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', width: '50%' }} />
                        </Box>
                      ))}
                    </Flex>
                  ) : (
                    <Flex direction="column" gap="3">
                      {/* Built-in rules */}
                      {redactionRules?.filter(r => r.is_builtin).map(rule => (
                        <Card key={rule.uuid} style={{ border: rule.is_enabled ? '2px solid var(--green-9)' : '1px solid var(--gray-6)' }}>
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="3" style={{ minWidth: 0, flex: 1 }}>
                              <Box style={{ fontSize: '18px', flexShrink: 0 }}>🔒</Box>
                              <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
                                <Flex align="center" gap="2" style={{ minHeight: '20px' }}>
                                  <Text size="2" weight="medium">{rule.rule_name}</Text>
                                  <Badge size="1" color="blue">Built-in</Badge>
                                  <Box style={{ minWidth: '50px', display: 'inline-flex' }}>
                                    {rule.is_enabled && <Badge size="1" color="green">Active</Badge>}
                                  </Box>
                                </Flex>
                                <Text size="1" color="gray">Replaces with: {rule.replacement}</Text>
                              </Flex>
                            </Flex>
                            <Switch
                              checked={rule.is_enabled}
                              onCheckedChange={(checked: boolean) => toggleRuleMutation.mutate({ ruleUuid: rule.uuid, is_enabled: checked })}
                            />
                          </Flex>
                        </Card>
                      ))}

                      {/* Custom rules */}
                      {redactionRules?.filter(r => !r.is_builtin).map(rule => (
                        <Card key={rule.uuid} style={{ border: rule.is_enabled ? '2px solid var(--purple-9)' : '1px solid var(--gray-6)' }}>
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="3" style={{ minWidth: 0, flex: 1 }}>
                              <Box style={{ fontSize: '18px', flexShrink: 0 }}>✏️</Box>
                              <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
                                <Flex align="center" gap="2" style={{ minHeight: '20px' }}>
                                  <Text size="2" weight="medium">{rule.rule_name}</Text>
                                  <Badge size="1" color="purple">Custom</Badge>
                                  <Box style={{ minWidth: '50px', display: 'inline-flex' }}>
                                    {rule.is_enabled && <Badge size="1" color="green">Active</Badge>}
                                  </Box>
                                </Flex>
                                <Text size="1" color="gray">Replaces with: {rule.replacement}</Text>
                              </Flex>
                            </Flex>
                            <Flex align="center" gap="3">
                              <Switch
                                checked={rule.is_enabled}
                                onCheckedChange={(checked: boolean) => toggleRuleMutation.mutate({ ruleUuid: rule.uuid, is_enabled: checked })}
                              />
                              <Button
                                size="1"
                                color="red"
                                variant="ghost"
                                onClick={() => deleteRuleMutation.mutate(rule.uuid)}
                              >
                                <Icons.TrashIcon />
                              </Button>
                            </Flex>
                          </Flex>
                        </Card>
                      ))}

                      {(!redactionRules || redactionRules.length === 0) && (
                        <Box style={{ textAlign: 'center', padding: '32px' }}>
                          <Text size="3" color="gray">No redaction rules found</Text>
                        </Box>
                      )}
                    </Flex>
                  )}
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" gap="3">
                  <Heading size="4">How Redaction Works</Heading>
                  <Text size="2" color="gray">
                    • <strong>Exports:</strong> When "Apply Redaction" is enabled on export, all enabled rules will scan session data and replace matches.
                  </Text>
                  <Text size="2" color="gray">
                    • <strong>Shared Sessions:</strong> Redaction rules are automatically applied to all shared session views.
                  </Text>
                  <Text size="2" color="gray">
                    • <strong>Your View:</strong> Your own session detail page always shows raw data — redaction only affects exports and shares.
                  </Text>
                </Flex>
              </Card>
            </Flex>

            {/* Add Custom Rule Dialog */}
            <Dialog.Root open={showAddRule} onOpenChange={setShowAddRule}>
              <Dialog.Content style={{ maxWidth: 500 }}>
                <Dialog.Title>Add Custom Redaction Rule</Dialog.Title>
                <Dialog.Description size="2" mb="4">
                  Create a regex pattern to match and redact sensitive data in session exports.
                </Dialog.Description>

                <Flex direction="column" gap="3">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Rule Name</Text>
                    <TextField.Root
                      placeholder="e.g., Internal Project Names"
                      value={newRule.rule_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule(prev => ({ ...prev, rule_name: e.target.value }))}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Regex Pattern</Text>
                    <TextField.Root
                      placeholder="e.g., secret_[a-zA-Z0-9]+"
                      value={newRule.pattern}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule(prev => ({ ...prev, pattern: e.target.value }))}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">Replacement Text</Text>
                    <TextField.Root
                      placeholder="e.g., [REDACTED]"
                      value={newRule.replacement}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule(prev => ({ ...prev, replacement: e.target.value }))}
                    />
                  </Flex>
                </Flex>

                <Flex gap="3" mt="4" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </Dialog.Close>
                  <Button
                    onClick={() => createRuleMutation.mutate(newRule)}
                    disabled={!newRule.rule_name || !newRule.pattern || createRuleMutation.isLoading}
                  >
                    {createRuleMutation.isLoading ? 'Creating...' : 'Create Rule'}
                  </Button>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Tabs.Content>

        </Tabs.Root>
      </Flex>
    </AppLayout>
  )
}

