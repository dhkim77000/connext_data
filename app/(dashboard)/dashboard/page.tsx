import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tenant } = await supabase
    .from('tenants').select('name').eq('owner_auth_id', user!.id).single()

  const { count: channelCount } = await supabase
    .from('channel_connections')
    .select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">{tenant?.name ?? 'Dashboard'}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Connected Channels</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{channelCount ?? 0}</p>
        </div>
      </div>
    </div>
  )
}
