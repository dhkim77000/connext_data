import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shopifyConnector } from '@/lib/connectors/shopify'
import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import { instagramConnector } from '@/lib/connectors/instagram'
import type { Connector } from '@/lib/connectors/types'

// The single source of truth for warehouse DDL (master plan §5 rule 3).
const V2_SPEC_PATH = join(process.cwd(), 'docs/specs/2026-07-05-warehouse-schema-v2.sql')

function v2TableNames(): Set<string> {
  const sql = readFileSync(V2_SPEC_PATH, 'utf8')
  const names = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS connext\.(\w+)/g)].map((m) => m[1])
  return new Set(names)
}

// Parse once — the spec file doesn't change mid-run.
const V2_TABLES = v2TableNames()

// Every dataType each connector can be asked to sync (the connector's public contract).
const CONNECTOR_CONTRACTS: Array<{ connector: Connector; dataTypes: string[] }> = [
  {
    connector: shopifyConnector,
    dataTypes: ['orders', 'order_line_items', 'products', 'product_variants', 'customers'],
  },
  { connector: metaAdsConnector, dataTypes: ['campaigns', 'insights'] },
  { connector: instagramConnector, dataTypes: ['media', 'account_insights'] },
]

describe('v2 schema contract', () => {
  it('parses the v2 spec into a plausible table set', () => {
    const tables = V2_TABLES
    // v2 ships 31 tables today; a collapsing parse (0–2 tables) means the regex broke.
    expect(tables.size).toBeGreaterThanOrEqual(31)
    expect(tables.has('shopify_orders_history')).toBe(true)
    expect(tables.has('meta_ads_insights_stat')).toBe(true)
  })

  it.each(
    CONNECTOR_CONTRACTS.flatMap(({ connector, dataTypes }) =>
      dataTypes.map((dataType) => ({ id: connector.id, connector, dataType })),
    ),
  )('$id targetTable($dataType) is a v2 table', ({ connector, dataType }) => {
    const table = connector.targetTable(dataType)
    expect(V2_TABLES.has(table), `"${table}" not found in v2 spec`).toBe(true)
  })

  it.each(CONNECTOR_CONTRACTS.map(({ connector }) => ({ id: connector.id, connector })))(
    '$id targetTable throws on an unknown dataType',
    ({ connector }) => {
      expect(() => connector.targetTable('no_such_data_type')).toThrow(/no target table/)
    },
  )
})
