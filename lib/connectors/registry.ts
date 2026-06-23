import type { Connector } from './types'

const registry = new Map<string, Connector>()

export function registerConnector(connector: Connector): void {
  registry.set(connector.id, connector)
}

export function getConnector(id: string): Connector {
  const connector = registry.get(id)
  if (!connector) throw new Error(`Unknown connector: ${id}`)
  return connector
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values())
}

export function __resetForTests(): void {
  registry.clear()
}
