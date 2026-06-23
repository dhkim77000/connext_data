import { createClient, type ClickHouseClient } from '@clickhouse/client'

let _client: ClickHouseClient | null = null

export function getCHClient(): ClickHouseClient {
  if (!_client) {
    _client = createClient({
      url: process.env.CLICKHOUSE_URL!,
      username: process.env.CLICKHOUSE_USERNAME ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD!,
      database: process.env.CLICKHOUSE_DATABASE ?? 'connext',
    })
  }
  return _client
}
