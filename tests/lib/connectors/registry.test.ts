import { describe, it, expect, beforeEach } from 'vitest'
import { registerConnector, getConnector, listConnectors, __resetForTests } from '@/lib/connectors/registry'
import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const mockConnector: Connector = {
  id: 'test_platform',
  displayName: 'Test Platform',
  authType: 'oauth2',
  fetch: async (_job: FetchJob): Promise<FetchResult> => ({ rows: [] }),
  targetTable: (dataType: string) => `test_${dataType}`,
}

describe('connector registry', () => {
  beforeEach(() => {
    __resetForTests()
  })

  it('registers and retrieves a connector by id', () => {
    registerConnector(mockConnector)
    expect(getConnector('test_platform')).toBe(mockConnector)
  })

  it('throws for unknown connector id', () => {
    expect(() => getConnector('nonexistent')).toThrow('Unknown connector: nonexistent')
  })

  it('lists all registered connectors', () => {
    registerConnector(mockConnector)
    const list = listConnectors()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('test_platform')
  })

  it('does not list connectors from previous tests after reset', () => {
    expect(listConnectors()).toHaveLength(0)
  })
})
