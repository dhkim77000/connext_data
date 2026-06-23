// app/api/data/route.ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { queryRows } from '@/lib/clickhouse/queries'

const ALLOWED_TABLES = new Set([
  'shopify_orders',
  'shopify_products',
  'meta_ads_campaigns',
  'meta_ads_insights',
])

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client to bypass RLS when reading from tenants table
  const service = await createServiceClient()
  const { data: tenant } = await service
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') ?? 'shopify_orders'
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
  }

  const rows = await queryRows(
    `SELECT * FROM ${table} WHERE tenant_id = {tenantId:String} ORDER BY ingested_at DESC LIMIT {limit:UInt32}`,
    { tenantId: tenant.id, limit },
  )

  return NextResponse.json({ rows, table })
}
