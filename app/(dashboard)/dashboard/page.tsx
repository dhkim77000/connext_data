import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { queryCH } from '@/lib/clickhouse/http'
import { TopProducts } from '@/components/dashboard/top-products'
import { ChannelTabs } from '@/components/dashboard/channel-tabs'
import { Label, Panel, Stat, BarRow, num as n } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { HourBars } from '@/components/charts/hour-bars'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { fmtCurrency, fmtInt, fmtCompact, fmtAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Metrics = {
  currency: string
  orders: number
  revenue: number
  aov: number
  byDay: { d: string; revenue: number; orders: number }[]
  products: { title: string; revenue: number; units: number }[]
  catalog: { products: number; variants: number; stock: number; lowStock: number; invValue: number }
  customers: { total: number; ltv: number }
  geo: { country: string; n: number }[]
  byCountry: { country: string; revenue: number; orders: number }[]
  topCities: { city: string; country: string; customers: number; spent: number }[]
  byHour: { hour: number; orders: number }[]
  topCustomers: { name: string; city: string; country: string; orders: number; spent: number }[]
  cohort: { new: number; returning: number }
  orderStatus: { refunded: number; pending: number; total: number }
  freshAt: string | null
}

async function loadMetrics(tenant: string): Promise<Metrics> {
  const p = { tenant }
  // shared deduped-orders subquery (an order can appear under >1 connection / re-sync)
  const O = `SELECT order_id, argMax(current_total_price, ingested_at) AS price,
      argMax(created_at, ingested_at) AS created_at, argMax(country_code, ingested_at) AS country_code,
      argMax(customer_id, ingested_at) AS customer_id, argMax(financial_status, ingested_at) AS fin
    FROM connext.shopify_orders_history WHERE tenant_id = {tenant:String} GROUP BY order_id`
  const C = `SELECT customer_id, argMax(first_name,ingested_at) first_name, argMax(last_name,ingested_at) last_name,
      argMax(city,ingested_at) city, argMax(country_code,ingested_at) country_code, argMax(amount_spent,ingested_at) amount_spent
    FROM connext.shopify_customers WHERE tenant_id = {tenant:String} GROUP BY customer_id`

  const [summary, byDay, products, prodCount, variants, custSummary, geo,
         byCountry, topCities, byHour, topCustomers, cohort, orderStatus, fresh] = await Promise.all([
    // Revenue/orders — dedup by order_id (an order can appear under >1 connection to the same store)
    queryCH(`SELECT count() AS orders, round(sum(price),2) AS revenue, round(avg(price),2) AS aov, any(cur) AS currency
             FROM (SELECT order_id, argMax(current_total_price, ingested_at) AS price, argMax(currency, ingested_at) AS cur
                   FROM connext.shopify_orders_history WHERE tenant_id = {tenant:String} GROUP BY order_id)`, p),
    queryCH(`SELECT d, round(sum(price),2) AS revenue, count() AS orders FROM (
               SELECT order_id, argMax(current_total_price, ingested_at) AS price, argMax(toDate(created_at), ingested_at) AS d
               FROM connext.shopify_orders_history WHERE tenant_id = {tenant:String} GROUP BY order_id
             ) GROUP BY d ORDER BY d`, p),
    queryCH(`SELECT title, round(sum(price*quantity),2) AS revenue, sum(quantity) AS units
             FROM connext.shopify_order_line_items_history FINAL WHERE tenant_id = {tenant:String}
             GROUP BY title ORDER BY revenue DESC LIMIT 10`, p),
    queryCH(`SELECT count() AS products FROM connext.shopify_products FINAL WHERE tenant_id = {tenant:String}`, p),
    queryCH(`SELECT count() AS variants, sum(inventory_quantity) AS stock,
                    countIf(inventory_quantity <= 5) AS low, round(sum(price*inventory_quantity),2) AS inv_value
             FROM connext.shopify_product_variants FINAL WHERE tenant_id = {tenant:String}`, p),
    queryCH(`SELECT count() AS customers, round(sum(amount_spent),2) AS ltv
             FROM connext.shopify_customers FINAL WHERE tenant_id = {tenant:String}`, p),
    queryCH(`SELECT if(country_code = '', 'Unknown', country_code) AS country, count() AS n
             FROM connext.shopify_customers FINAL WHERE tenant_id = {tenant:String} GROUP BY country ORDER BY n DESC`, p),
    // revenue by country (from order shipping country)
    queryCH(`SELECT if(country_code='','Unknown',country_code) AS country, round(sum(price),2) AS revenue, count() AS orders
             FROM (${O}) GROUP BY country ORDER BY revenue DESC`, p),
    // top cities (from customer address)
    queryCH(`SELECT if(city='','Unknown',city) AS city, any(country_code) AS country, count() AS customers, round(sum(amount_spent),2) AS spent
             FROM (${C}) WHERE city != '' GROUP BY city ORDER BY spent DESC LIMIT 8`, p),
    // orders by hour of day
    queryCH(`SELECT toHour(created_at) AS hour, count() AS orders FROM (${O}) GROUP BY hour ORDER BY hour`, p),
    // top customers by spend (join name/city; PII may be blank for real redacted customers)
    queryCH(`SELECT trim(concat(c.first_name,' ',c.last_name)) AS name, c.city AS city, c.country_code AS country,
                    o.orders AS orders, round(o.spent,2) AS spent
             FROM (SELECT customer_id, count() AS orders, sum(price) AS spent FROM (${O}) WHERE customer_id!='' GROUP BY customer_id) o
             LEFT JOIN (${C}) c ON o.customer_id = c.customer_id
             ORDER BY spent DESC LIMIT 8`, p),
    // new vs returning customers
    queryCH(`SELECT countIf(c=1) AS new, countIf(c>1) AS returning
             FROM (SELECT customer_id, count() AS c FROM (${O}) WHERE customer_id!='' GROUP BY customer_id)`, p),
    // order financial status (for return rate)
    queryCH(`SELECT countIf(fin='refunded') AS refunded, countIf(fin='pending') AS pending, count() AS total FROM (${O})`, p),
    queryCH(`SELECT max(ingested_at) AS ts FROM connext.shopify_products WHERE tenant_id = {tenant:String}`, p),
  ])

  return {
    currency: (summary[0]?.currency as string) || 'USD',
    orders: n(summary[0]?.orders),
    revenue: n(summary[0]?.revenue),
    aov: n(summary[0]?.aov),
    byDay: byDay.map((r) => ({ d: String(r.d), revenue: n(r.revenue), orders: n(r.orders) })),
    products: products.map((r) => ({ title: String(r.title), revenue: n(r.revenue), units: n(r.units) })),
    catalog: {
      products: n(prodCount[0]?.products),
      variants: n(variants[0]?.variants),
      stock: n(variants[0]?.stock),
      lowStock: n(variants[0]?.low),
      invValue: n(variants[0]?.inv_value),
    },
    customers: { total: n(custSummary[0]?.customers), ltv: n(custSummary[0]?.ltv) },
    geo: geo.map((r) => ({ country: String(r.country), n: n(r.n) })),
    byCountry: byCountry.map((r) => ({ country: String(r.country), revenue: n(r.revenue), orders: n(r.orders) })),
    topCities: topCities.map((r) => ({ city: String(r.city), country: String(r.country), customers: n(r.customers), spent: n(r.spent) })),
    byHour: byHour.map((r) => ({ hour: n(r.hour), orders: n(r.orders) })),
    topCustomers: topCustomers.map((r) => ({ name: String(r.name || '').trim(), city: String(r.city || ''), country: String(r.country || ''), orders: n(r.orders), spent: n(r.spent) })),
    cohort: { new: n(cohort[0]?.new), returning: n(cohort[0]?.returning) },
    orderStatus: { refunded: n(orderStatus[0]?.refunded), pending: n(orderStatus[0]?.pending), total: n(orderStatus[0]?.total) },
    freshAt: (fresh[0]?.ts as string) ?? null,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants').select('id, name').eq('owner_auth_id', user.id).single()

  let metrics: Metrics | null = null
  let error: string | null = null
  if (tenant) {
    try {
      metrics = await loadMetrics(tenant.id)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const cur = metrics?.currency ?? 'USD'
  const days = metrics?.byDay ?? []
  // Day-over-day delta only when we actually have ≥2 days — no fabricated comparisons.
  const delta =
    days.length >= 2 && days[days.length - 2].revenue > 0
      ? ((days[days.length - 1].revenue - days[days.length - 2].revenue) / days[days.length - 2].revenue) * 100
      : null

  const cohort = metrics?.cohort ?? { new: 0, returning: 0 }
  const buyers = cohort.new + cohort.returning
  const repeatRate = buyers ? (cohort.returning / buyers) * 100 : 0
  const os = metrics?.orderStatus ?? { refunded: 0, pending: 0, total: 0 }
  const returnRate = os.total ? (os.refunded / os.total) * 100 : 0
  const maxCountryRev = Math.max(...(metrics?.byCountry ?? []).map((c) => c.revenue), 1)
  const maxCityRev = Math.max(...(metrics?.topCities ?? []).map((c) => c.spent), 1)
  const maxGeo = Math.max(...(metrics?.geo ?? []).map((x) => x.n), 1)
  const hourMap = new Map((metrics?.byHour ?? []).map((x) => [x.hour, x.orders]))

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* header + freshness */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Label>Analytics</Label>
          <h1 className="mt-1.5 text-xl font-medium tracking-tight">{tenant?.name ?? 'Overview'}</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
          Data as of {fmtAgo(metrics?.freshAt, Date.now())}
        </div>
      </div>

      <ChannelTabs />

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn’t reach the warehouse — {error}
        </div>
      )}

      {metrics && (
        <>
        <div className="cx-stagger grid gap-3 lg:grid-cols-12">
          {/* Dominant: revenue trend (Revenue|Orders take turns on one axis) */}
          <Panel className="lg:col-span-7">
            <Label>Revenue</Label>
            <div className="mt-3 flex items-baseline gap-3">
              <p className="text-5xl font-semibold tracking-tight">
                <AnimatedNumber value={metrics.revenue} format="currency" currency={cur} />
              </p>
              {delta !== null && (
                <span className={`font-mono text-sm tabular-nums ${delta >= 0 ? 'text-pos' : 'text-neg'}`}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {fmtInt(metrics.orders)} order{metrics.orders === 1 ? '' : 's'} · AOV {fmtCurrency(metrics.aov, cur)}
            </p>
            <div className="mt-5">
              <TrendExplorer
                data={days.map((d) => ({ x: d.d, revenue: d.revenue, orders: d.orders }))}
                metrics={[
                  { key: 'revenue', label: 'Revenue', format: 'currency' },
                  { key: 'orders', label: 'Orders', format: 'int' },
                ]}
                currency={cur}
                height={190}
              />
            </div>
          </Panel>

          {/* KPI 2x2 */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <Stat label="Orders" value={fmtInt(metrics.orders)} sub={`${days.length} active day${days.length === 1 ? '' : 's'}`} />
            <Stat label="Avg order value" value={fmtCurrency(metrics.aov, cur)} />
            <Stat label="Customers" value={fmtInt(metrics.customers.total)} sub={`LTV ${fmtCurrency(metrics.customers.ltv, cur)}`} />
            <Stat label="Catalog" value={fmtInt(metrics.catalog.products)} sub={`${fmtInt(metrics.catalog.variants)} variants`} />
          </div>

          {/* Top products */}
          <Panel className="lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <Label>Top products by revenue</Label>
            </div>
            <TopProducts rows={metrics.products} currency={cur} />
          </Panel>

          {/* Inventory */}
          <Panel className="lg:col-span-5">
            <Label>Inventory</Label>
            <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{fmtCurrency(metrics.catalog.invValue, cur)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">on-hand value</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-lg font-medium tabular-nums">{fmtInt(metrics.catalog.stock)}</p>
                <Label>units in stock</Label>
              </div>
              <div>
                <p className={`text-lg font-medium tabular-nums ${metrics.catalog.lowStock > 0 ? 'text-neg' : ''}`}>
                  {fmtInt(metrics.catalog.lowStock)}
                </p>
                <Label>low stock (≤5)</Label>
              </div>
            </div>
          </Panel>

          {/* Customers by geography */}
          <Panel className="lg:col-span-5">
            <Label>Customers by region</Label>
            {metrics.geo.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">No customers yet.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {metrics.geo.map((g) => (
                  <BarRow
                    key={g.country}
                    label={g.country}
                    value={fmtInt(g.n)}
                    pct={(g.n / maxGeo) * 100}
                    title={`${g.country} — ${fmtInt(g.n)} customers`}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* Freshness / source note */}
          <Panel className="lg:col-span-7 flex flex-col justify-center">
            <Label>Source</Label>
            <p className="mt-2 text-sm text-muted-foreground">
              Live from the connext warehouse (ClickHouse). {fmtCompact(metrics.catalog.variants)} variants ·{' '}
              {fmtInt(metrics.customers.total)} customers synced. Numbers dedupe orders across duplicate store
              connections and update as syncs run.
            </p>
          </Panel>
        </div>

        {/* ============ ADVANCED — customer & behaviour ============ */}
        <div className="mt-9 mb-4 flex items-center gap-4">
          <Label>Customer &amp; behaviour</Label>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <div className="cx-stagger grid gap-3 lg:grid-cols-12">
          {/* repeat / return / buyers */}
          <Panel className="lg:col-span-4">
            <Label>Repeat customers</Label>
            <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{repeatRate.toFixed(0)}%</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {fmtInt(cohort.returning)} returning · {fmtInt(cohort.new)} new
            </p>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" title="returning vs new">
              <span className="bg-cx-accent" style={{ width: `${repeatRate}%` }} aria-hidden />
            </div>
          </Panel>
          <Panel className="lg:col-span-4">
            <Label>Return rate</Label>
            <p className={`mt-3 text-2xl font-medium tabular-nums tracking-tight ${returnRate > 10 ? 'text-neg' : ''}`}>
              {returnRate.toFixed(1)}%
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {fmtInt(os.refunded)} refunded / {fmtInt(os.total)} orders
            </p>
          </Panel>
          <Panel className="lg:col-span-4">
            <Label>Buyers</Label>
            <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{fmtInt(buyers)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{fmtInt(os.pending)} orders pending</p>
          </Panel>

          {/* revenue by country */}
          <Panel className="lg:col-span-6">
            <Label>Revenue by country</Label>
            <ul className="mt-4 space-y-2.5">
              {metrics.byCountry.map((c) => (
                <BarRow
                  key={c.country}
                  label={c.country}
                  value={fmtCurrency(c.revenue, cur)}
                  pct={(c.revenue / maxCountryRev) * 100}
                  title={`${c.country} — ${fmtInt(c.orders)} orders`}
                />
              ))}
            </ul>
          </Panel>

          {/* top cities */}
          <Panel className="lg:col-span-6">
            <Label>Top cities</Label>
            {metrics.topCities.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">No city data.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {metrics.topCities.map((c) => (
                  <BarRow
                    key={c.city}
                    label={c.city}
                    value={fmtCurrency(c.spent, cur)}
                    pct={(c.spent / maxCityRev) * 100}
                    title={`${c.city}, ${c.country} — ${fmtInt(c.customers)} customers`}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* orders by hour */}
          <Panel className="lg:col-span-5">
            <div className="mb-6">
              <Label>Orders by time of day</Label>
            </div>
            <HourBars hours={Array.from({ length: 24 }, (_, h) => hourMap.get(h) ?? 0)} unit="orders" />
          </Panel>

          {/* top customers */}
          <Panel className="lg:col-span-7">
            <Label>Top customers</Label>
            {metrics.topCustomers.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">No customer orders yet.</p>
            ) : (
              <table className="mt-3 w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Customer</th>
                    <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">City</th>
                    <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Orders</th>
                    <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topCustomers.map((c, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 text-sm">{c.name || 'Customer'}</td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{c.city || c.country || '—'}</td>
                      <td className="py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{fmtInt(c.orders)}</td>
                      <td className="py-2.5 text-right text-sm tabular-nums">{fmtCurrency(c.spent, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
        </>
      )}
    </div>
  )
}
