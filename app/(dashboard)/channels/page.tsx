import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChannelCard } from '@/components/channel-card'

const AVAILABLE_CONNECTORS = [
  { id: 'shopify', label: 'Shopify' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'instagram', label: 'Instagram' },
]

export default async function ChannelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) redirect('/login')

  const { data: connections } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const connectedIds = new Set((connections ?? []).map((c) => c.connector_id))

  const available = AVAILABLE_CONNECTORS.filter((c) => !connectedIds.has(c.id))

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Channels</h1>

      {connections && connections.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Connected</p>
          <div className="space-y-2">
            {connections.map((c) => <ChannelCard key={c.id} connection={c} />)}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add a channel</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.map((connector) => (
              <Link
                key={connector.id}
                href={`/channels/connect/${connector.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                {connector.label}
                <span className="text-muted-foreground text-base leading-none">+</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
