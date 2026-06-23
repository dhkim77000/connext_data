import { getCHClient } from './client'

export async function insertRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return
  const ch = getCHClient()
  await ch.insert({ table, values: rows, format: 'JSONEachRow' })
}

export async function queryRows<T>(
  query: string,
  queryParams?: Record<string, unknown>,
): Promise<T[]> {
  const ch = getCHClient()
  const result = await ch.query({ query, query_params: queryParams, format: 'JSONEachRow' })
  return result.json<T>()
}
