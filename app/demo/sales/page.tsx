// Demo · Sales — store revenue broken down by product (stacked), the product
// table, and the basket-size trend.

import { Label, Panel, Stat } from '@/components/dashboard/ui'
import { StackedAreaChart } from '@/components/charts/stacked-area'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { fmtCurrency, fmtInt } from '@/lib/format'
import { demoDays, demoSummary as s, demoProductStack, demoProductBands, demoProducts } from '@/lib/demo/data'

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export default function DemoSalesPage() {
  const maxProdRev = Math.max(...demoProducts.map((p) => p.revenue), 1)
  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* Revenue stacked by product — the composition IS the story */}
      <Panel className="lg:col-span-8">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <Label>Revenue by product · 90 days</Label>
          <p className="text-2xl font-semibold tracking-tight">
            <AnimatedNumber value={s.revenue} format="currency" />
          </p>
        </div>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          Each band is a product; the height is total daily revenue. Glow Serum swells on reel days, sunscreen
          in the summer campaign. Click a product to isolate it.
        </p>
        <StackedAreaChart data={demoProductStack} bands={demoProductBands} format="currency" height={230} />
      </Panel>

      {/* KPI rail */}
      <div className="grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-1">
        <Stat label="Orders" value={fmtInt(s.orders)} sub="90-day total" />
        <Stat label="Average order" value={fmtCurrency(s.aov)} sub="basket size" />
        <Stat label="Products sold" value={fmtInt(demoProducts.reduce((a, p) => a + p.units, 0))} sub="units, all SKUs" />
      </div>

      {/* Top products */}
      <Panel className="lg:col-span-7">
        <Label>Top products</Label>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <Th>Product</Th>
              <Th right>Revenue</Th>
              <Th right>Units</Th>
              <Th right>Share</Th>
            </tr>
          </thead>
          <tbody>
            {demoProducts.map((p) => (
              <tr key={p.title} className="group border-b border-border/60 last:border-0">
                <td className="relative py-2.5 pr-4">
                  <span className="relative z-10 text-sm">{p.title}</span>
                  <span
                    className="absolute inset-y-1 left-0 rounded-sm bg-cx-accent/10"
                    style={{ width: `${(p.revenue / maxProdRev) * 100}%` }}
                    aria-hidden
                  />
                </td>
                <td className="py-2.5 text-right text-sm tabular-nums">{fmtCurrency(p.revenue)}</td>
                <td className="py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtInt(p.units)}</td>
                <td className="py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {Math.round((p.revenue / s.revenue) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Basket-size / orders trend */}
      <Panel className="lg:col-span-5">
        <Label>Orders & basket size</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Daily orders and average order value.</p>
        <TrendExplorer
          data={demoDays.map((d) => ({ x: d.x, orders: d.orders, aov: d.orders ? Math.round(d.revenue / d.orders) : 0 }))}
          metrics={[
            { key: 'orders', label: 'Orders', format: 'int' },
            { key: 'aov', label: 'Avg order', format: 'currency', baseline: 'auto' },
          ]}
          height={180}
        />
      </Panel>
    </div>
  )
}
