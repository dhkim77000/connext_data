import { getConnector } from '@/lib/connectors/registry'
import { insertRows } from '@/lib/clickhouse/queries'
import type { FetchJob } from '@/lib/connectors/types'

export interface ProcessResult {
  rowsIngested: number
  pages: number
}

export async function processJob(job: FetchJob): Promise<ProcessResult> {
  const connector = getConnector(job.connectorId)
  let cursor: string | undefined = job.cursor
  let rowsIngested = 0
  let pages = 0

  do {
    const result = await connector.fetch({ ...job, cursor })
    const table = connector.targetTable(job.dataType)

    if (result.rows.length > 0) {
      await insertRows(table, result.rows)
      rowsIngested += result.rows.length
    }

    cursor = result.nextCursor
    pages++
  } while (cursor !== undefined)

  return { rowsIngested, pages }
}
