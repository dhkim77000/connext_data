export interface ConnectorCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  extra?: Record<string, string>
}

export interface FetchJob {
  tenantId: string
  connectorId: string
  credentials: ConnectorCredentials
  dataType: string
  since: Date
  until: Date
  cursor?: string
}

export interface FetchResult {
  rows: Record<string, unknown>[]
  nextCursor?: string
  rateLimitRemaining?: number
}

export interface Connector {
  readonly id: string
  readonly displayName: string
  readonly authType: 'oauth2' | 'api_key'
  fetch(job: FetchJob): Promise<FetchResult>
  targetTable(dataType: string): string
  refreshCredentials?(creds: ConnectorCredentials): Promise<ConnectorCredentials>
}
