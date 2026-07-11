// app/(dashboard)/data/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { DATA_VIEWER_TABLES, DEFAULT_DATA_VIEWER_TABLE } from '@/lib/warehouse-tables'

export default function DataPage() {
  const [table, setTable] = useState<string>(DEFAULT_DATA_VIEWER_TABLE)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/data?table=${table}&limit=50`)
      .then((r) => r.json())
      .then(({ rows, error }) => {
        if (error) setError(error)
        else setRows(rows ?? [])
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [table])

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold">Raw Data</h1>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DATA_VIEWER_TABLES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable rows={rows} />
      )}
    </div>
  )
}
