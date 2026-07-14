import { Badge } from '@/components/ui/badge'
import { SyncButton } from '@/components/sync-button'
import type { Database } from '@/lib/supabase/types'

type ChannelConnection = Database['public']['Tables']['channel_connections']['Row']

// Channel identity: label is the title, mono is the icon glyph, color drives the accent.
const CONNECTORS: Record<string, { label: string; mono: string; color: string }> = {
  shopify: { label: 'Shopify', mono: 'S', color: 'var(--ch-shopify)' },
  meta_ads: { label: 'Meta Ads', mono: 'M', color: 'var(--ch-meta)' },
  instagram: { label: 'Instagram', mono: 'IG', color: '#C13584' },
  ga4: { label: 'Google Analytics 4', mono: 'GA', color: '#E8710A' },
  google_ads: { label: 'Google Ads', mono: 'Ad', color: '#3B82F6' },
  youtube: { label: 'YouTube', mono: 'YT', color: 'var(--ch-youtube)' },
  tiktok: { label: 'TikTok Ads', mono: 'TT', color: 'var(--ch-tiktok)' },
  naver_search_ad: { label: '네이버 검색광고', mono: 'N', color: 'var(--ch-naver)' },
  naver_commerce: { label: '네이버 스마트스토어', mono: 'N', color: 'var(--ch-naver)' },
  kakao_moment: { label: '카카오 모먼트', mono: 'K', color: '#EAB308' },
  cafe24: { label: 'Cafe24', mono: 'C', color: '#3B82F6' },
  coupang: { label: '쿠팡 WING', mono: 'CP', color: '#EF4444' },
}

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'secondary'> = {
  active: 'default',
  error: 'destructive',
  paused: 'secondary',
}

export function ChannelCard({ connection }: { connection: ChannelConnection }) {
  const meta = CONNECTORS[connection.connector_id] ?? {
    label: connection.connector_id,
    mono: connection.connector_id.slice(0, 2).toUpperCase(),
    color: 'var(--cx-dim)',
  }

  // Show the account/store name only when it adds info beyond the channel label.
  const account =
    connection.display_name && connection.display_name !== meta.label
      ? connection.display_name
      : null

  const synced = connection.last_synced_at
    ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
    : 'Never synced'

  return (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-card px-3 py-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold tracking-tight"
        style={{
          backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
          color: meta.color,
        }}
        aria-hidden
      >
        {meta.mono}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold leading-tight">{meta.label}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {account && <span className="truncate text-foreground/70">{account}</span>}
          {account && <span className="text-cx-dim">·</span>}
          <span className="font-mono">{synced}</span>
        </p>
      </div>

      <Badge variant={STATUS_VARIANT[connection.status] ?? 'secondary'}>{connection.status}</Badge>
      <SyncButton connectionId={connection.id} connectorId={connection.connector_id} />
    </div>
  )
}
