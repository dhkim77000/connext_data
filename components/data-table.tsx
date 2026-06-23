// components/data-table.tsx
type Row = Record<string, unknown>

export function DataTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data yet. Trigger a sync from the Channels page to load data.
      </p>
    )
  }

  const columns = Object.keys(rows[0]).filter((k) => k !== 'raw')

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/40 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-xs text-foreground max-w-48 truncate">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
