'use client'

// "Sync now" for a channel connection. Fires POST /api/sync per dataType
// (the route enqueues a job + kicks the async processor). Expand to sync a
// single dataType, or run them all.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SYNC_DATA_TYPES } from '@/lib/sync-datatypes'

type Phase = 'idle' | 'syncing' | 'done' | 'error'

export function SyncButton({ connectionId, connectorId }: { connectionId: string; connectorId: string }) {
  const router = useRouter()
  const types = SYNC_DATA_TYPES[connectorId] ?? []
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState('')
  const [busyType, setBusyType] = useState<string | null>(null)

  if (types.length === 0) return null

  async function trigger(dataType: string): Promise<boolean> {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, dataType }),
    })
    return res.ok
  }

  async function syncOne(dataType: string, label: string) {
    setBusyType(dataType)
    const ok = await trigger(dataType)
    setBusyType(null)
    setPhase(ok ? 'done' : 'error')
    setProgress(ok ? `${label} sync queued` : `${label} failed`)
    if (ok) setTimeout(() => router.refresh(), 2500)
  }

  async function syncAll() {
    setPhase('syncing')
    let done = 0
    let failed = 0
    for (const t of types) {
      setProgress(`Syncing ${t.label}… (${done + failed + 1}/${types.length})`)
      const ok = await trigger(t.key)
      ok ? done++ : failed++
    }
    setPhase(failed ? 'error' : 'done')
    setProgress(failed ? `${done} queued · ${failed} failed` : `${done} sync jobs queued`)
    setTimeout(() => router.refresh(), 3000)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {phase !== 'idle' && (
          <span
            className={`font-mono text-[11px] tabular-nums ${phase === 'error' ? 'text-neg' : phase === 'done' ? 'text-pos' : 'text-muted-foreground'}`}
          >
            {progress}
          </span>
        )}
        <button
          type="button"
          onClick={syncAll}
          disabled={phase === 'syncing'}
          className="cx-press rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
        >
          {phase === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Choose data types to sync"
          className="cx-press rounded-full border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {open ? '▲' : '▾'}
        </button>
      </div>

      {open && (
        <div className="mt-1 flex flex-wrap justify-end gap-1">
          {types.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => syncOne(t.key, t.label)}
              disabled={busyType !== null || phase === 'syncing'}
              className="cx-press rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {busyType === t.key ? '…' : t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
