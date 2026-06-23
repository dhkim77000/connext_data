import { Badge } from '@/components/ui/badge'
import type { Database } from '@/lib/supabase/types'

type ChannelConnection = Database['public']['Tables']['channel_connections']['Row']

const CONNECTOR_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  meta_ads: 'Meta Ads',
}

export function ChannelCard({ connection }: { connection: ChannelConnection }) {
  const variantMap: Record<string, 'default' | 'destructive' | 'secondary'> = {
    active: 'default',
    error: 'destructive',
    paused: 'secondary',
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-medium">
          {connection.display_name || CONNECTOR_LABELS[connection.connector_id] || connection.connector_id}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {connection.last_synced_at
            ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
            : 'Never synced'}
        </p>
      </div>
      <Badge variant={variantMap[connection.status] ?? 'secondary'}>{connection.status}</Badge>
    </div>
  )
}
