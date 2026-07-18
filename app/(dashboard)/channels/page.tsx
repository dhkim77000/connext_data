import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChannelCard } from '@/components/channel-card'
import { CONNECTORS, CONNECTOR_GROUPS } from '@/lib/connectors-meta'

export default async function ChannelsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_auth_id', user.id)
    .single()
  if (!tenant) redirect('/login')

  const { data: connections } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const connectedIds = new Set((connections ?? []).map((c) => c.connector_id))
  const available = CONNECTORS.filter((c) => !connectedIds.has(c.id))

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">채널 연결</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        데이터를 가져올 채널을 연결하세요. 한 번 연결하면 대시보드에 자동으로 모여요.
      </p>

      {connections && connections.length > 0 && (
        <section className="mt-8">
          <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            연결됨 · {connections.length}
          </p>
          <div className="space-y-2">
            {connections.map((c) => (
              <ChannelCard key={c.id} connection={c} />
            ))}
          </div>
        </section>
      )}

      {CONNECTOR_GROUPS.map((group) => {
        const items = available.filter((c) => c.group === group)
        if (items.length === 0) return null
        return (
          <section key={group} className="mt-8">
            <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <div className="space-y-2">
              {items.map((c) => (
                <Link
                  key={c.id}
                  href={`/channels/connect/${c.id}`}
                  className="group flex items-center gap-3 border border-border bg-card px-3.5 py-3 transition-colors hover:border-cx-accent"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center font-mono text-sm font-semibold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${c.color} 16%, transparent)`,
                      color: c.color,
                    }}
                    aria-hidden
                  >
                    {c.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{c.brings}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-medium text-muted-foreground transition-colors group-hover:text-cx-accent">
                    연결 →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
