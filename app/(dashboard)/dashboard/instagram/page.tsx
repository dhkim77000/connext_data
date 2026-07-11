import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { queryCH } from '@/lib/clickhouse/http'
import { ChannelTabs } from '@/components/dashboard/channel-tabs'
import { Label, Panel, Stat, num as n } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { fmtInt, fmtAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function InstagramPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: tenant } = await supabase
    .from('tenants').select('id, name').eq('owner_auth_id', user.id).single()

  let account: Record<string, unknown> | undefined
  let daily: { date: string; followers: number; reach: number }[] = []
  let posts: Record<string, unknown> | undefined
  let top: { caption: string; type: string; likes: number; comments: number }[] = []
  let error: string | null = null

  if (tenant) {
    try {
      const p = { tenant: tenant.id }
      const [acc, day, ps, tp] = await Promise.all([
        queryCH(`SELECT argMax(follower_count,date) AS followers, argMin(follower_count,date) AS followers_start,
                        sum(reach) AS reach, sum(profile_views) AS profile_views, max(ingested_at) AS ts
                 FROM connext.instagram_account_insights_stat FINAL WHERE tenant_id = {tenant:String}`, p),
        queryCH(`SELECT date, argMax(follower_count,ingested_at) AS followers, argMax(reach,ingested_at) AS reach
                 FROM connext.instagram_account_insights_stat WHERE tenant_id = {tenant:String} GROUP BY date ORDER BY date`, p),
        queryCH(`SELECT count() AS posts, round(avg(like_count),0) AS avg_likes, round(avg(comments_count),0) AS avg_comments,
                        sum(like_count) AS total_likes
                 FROM connext.instagram_media FINAL WHERE tenant_id = {tenant:String}`, p),
        queryCH(`SELECT caption, media_type AS type, like_count AS likes, comments_count AS comments
                 FROM connext.instagram_media FINAL WHERE tenant_id = {tenant:String} ORDER BY like_count DESC LIMIT 8`, p),
      ])
      account = acc[0]
      daily = day.map((r) => ({ date: String(r.date), followers: n(r.followers), reach: n(r.reach) }))
      posts = ps[0]
      top = tp.map((r) => ({ caption: String(r.caption || ''), type: String(r.type || ''), likes: n(r.likes), comments: n(r.comments) }))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const followers = n(account?.followers)
  const start = n(account?.followers_start)
  const growth = start ? ((followers - start) / start) * 100 : 0
  const postCount = n(posts?.posts)
  const avgLikes = n(posts?.avg_likes)
  const avgComments = n(posts?.avg_comments)
  const engRate = followers ? ((avgLikes + avgComments) / followers) * 100 : 0
  const hasData = followers > 0 || postCount > 0

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Label>Analytics · Instagram</Label>
          <h1 className="mt-1.5 text-xl font-medium tracking-tight">{tenant?.name ?? 'Overview'}</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
          Data as of {fmtAgo((account?.ts as string) ?? null, Date.now())}
        </div>
      </div>

      <ChannelTabs />

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn’t reach the warehouse — {error}
        </div>
      )}

      {!hasData ? (
        <Panel className="flex flex-col items-center justify-center py-16 text-center">
          <Label>No Instagram data yet</Label>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Reconnect Instagram and run a sync to see follower growth, reach, and post performance here.
          </p>
        </Panel>
      ) : (
        <div className="cx-stagger grid gap-3 lg:grid-cols-12">
          {/* Followers — dominant (Followers|Reach take turns on one axis) */}
          <Panel className="lg:col-span-7">
            <Label>Followers</Label>
            <div className="mt-3 flex items-baseline gap-3">
              <p className="text-5xl font-semibold tracking-tight">
                <AnimatedNumber value={followers} format="int" />
              </p>
              <span className={`font-mono text-sm tabular-nums ${growth >= 0 ? 'text-pos' : 'text-neg'}`}>
                {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              +{fmtInt(followers - start)} in {daily.length} days
            </p>
            <div className="mt-5">
              <TrendExplorer
                data={daily.map((d) => ({ x: d.date, followers: d.followers, reach: d.reach }))}
                metrics={[
                  // follower counts move in a narrow band — a zero baseline would flatline them
                  { key: 'followers', label: 'Followers', format: 'int', baseline: 'auto' },
                  { key: 'reach', label: 'Reach', format: 'int' },
                ]}
                height={190}
              />
            </div>
          </Panel>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <Stat label="Posts" value={fmtInt(postCount)} sub="last 60 days" />
            <Stat label="Engagement rate" value={`${engRate.toFixed(2)}%`} sub="per follower" />
            <Stat label="Avg likes / post" value={fmtInt(avgLikes)} />
            <Stat label="Avg comments / post" value={fmtInt(avgComments)} />
          </div>

          {/* Reach summary */}
          <Panel className="lg:col-span-5">
            <Label>Reach (daily)</Label>
            <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{fmtInt(n(account?.reach))}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">accounts reached · {daily.length}d</p>
          </Panel>

          {/* Top posts */}
          <Panel className="lg:col-span-7">
            <Label>Top posts by likes</Label>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Post</th>
                  <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Type</th>
                  <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Likes</th>
                  <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Comments</th>
                </tr>
              </thead>
              <tbody>
                {top.map((post, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="max-w-0 truncate py-2.5 pr-4 text-sm">{post.caption || '—'}</td>
                    <td className="py-2.5 font-mono text-[11px] text-muted-foreground">{post.type.replace('_ALBUM', '')}</td>
                    <td className="py-2.5 text-right text-sm tabular-nums">{fmtInt(post.likes)}</td>
                    <td className="py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{fmtInt(post.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </div>
  )
}
