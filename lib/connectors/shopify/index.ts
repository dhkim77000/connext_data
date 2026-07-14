import type { Connector, ConnectorCredentials, FetchJob, FetchResult } from '@/lib/connectors/types'

const SHOPIFY_API_VERSION = '2024-01'

function ordersUrl(shopUrl: string, since: Date, until: Date, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250', status: 'any' })
  if (cursor) {
    params.set('page_info', cursor)
  } else {
    params.set('created_at_min', since.toISOString())
    params.set('created_at_max', until.toISOString())
  }
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params}`
}

function productsUrl(shopUrl: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) params.set('page_info', cursor)
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/products.json?${params}`
}

function customersUrl(shopUrl: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) params.set('page_info', cursor)
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/customers.json?${params}`
}

function simpleUrl(shopUrl: string, resource: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) params.set('page_info', cursor)
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/${resource}.json?${params}`
}

function checkoutsUrl(shopUrl: string, since: Date, until: Date, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) {
    params.set('page_info', cursor)
  } else {
    params.set('created_at_min', since.toISOString())
    params.set('created_at_max', until.toISOString())
  }
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/checkouts.json?${params}`
}

function extractNextCursor(headers: { has(h: string): boolean; get(h: string): string | null }): string | undefined {
  if (!headers.has('Link')) return undefined
  const link = headers.get('Link') ?? ''
  const match = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
  return match?.[1]
}

async function shopifyFetch(
  url: string,
  accessToken: string,
): Promise<{ body: Record<string, unknown>; nextCursor: string | undefined }> {
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`Shopify API error: ${response.status}`)
  const body = (await response.json()) as Record<string, unknown>
  return { body, nextCursor: extractNextCursor(response.headers) }
}

export const shopifyConnector: Connector = {
  id: 'shopify',
  displayName: 'Shopify',
  authType: 'oauth2',

  targetTable(dataType: string): string {
    // v2 warehouse naming: suffix encodes time semantics (docs/specs/2026-07-05-warehouse-schema-v2.sql)
    const map: Record<string, string> = {
      orders: 'shopify_orders_history',                        // event stream
      order_line_items: 'shopify_order_line_items_history',    // event (per order line)
      products: 'shopify_products',                            // current-state snapshot
      product_variants: 'shopify_product_variants',            // snapshot
      customers: 'shopify_customers',                          // snapshot
      price_rules: 'shopify_price_rules',                      // coupon/referral code definitions
      discount_codes: 'shopify_discount_codes',                // codes under each price rule
      marketing_events: 'shopify_marketing_events',            // UTM campaigns (attribution)
      abandoned_checkouts: 'shopify_abandoned_checkouts_history', // event stream (cart recovery)
    }
    const table = map[dataType]
    if (!table) throw new Error(`Shopify connector: no target table for dataType "${dataType}"`)
    return table
  },

  async fetch(job: FetchJob): Promise<FetchResult> {
    const shopUrl = job.credentials.extra?.shop_url
    if (!shopUrl) throw new Error('Shopify connector requires credentials.extra.shop_url')

    if (job.dataType === 'orders') {
      const url = ordersUrl(shopUrl, job.since, job.until, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const orders = (body.orders as Record<string, unknown>[]) ?? []
      return {
        rows: orders.map((order) => {
          const shipAddr = (order.shipping_address as Record<string, unknown> | null) ?? {}
          const shipSet = (order.total_shipping_price_set as Record<string, unknown> | null) ?? {}
          const shipMoney = (shipSet.shop_money as Record<string, unknown> | null) ?? {}
          const codes = (order.discount_codes as Record<string, unknown>[] | null) ?? []
          const tags = typeof order.tags === 'string' && order.tags ? order.tags.split(', ') : []
          const lineItems = (order.line_items as unknown[] | null) ?? []
          return {
            tenant_id: job.tenantId,
            connection_id: job.connectionId,
            raw: JSON.stringify(order),
            order_id: String(order.id),
            order_gid: order.admin_graphql_api_id ?? '',
            name: order.name ?? '',
            created_at: order.created_at,
            updated_at: order.updated_at,
            processed_at: order.processed_at ?? undefined,
            cancelled_at: order.cancelled_at ?? undefined,
            closed_at: order.closed_at ?? undefined,
            cancel_reason: order.cancel_reason ?? '',
            financial_status: order.financial_status ?? '',
            fulfillment_status: order.fulfillment_status ?? '',
            currency: order.currency ?? '',
            current_total_price: Number(order.total_price ?? 0),   // v2 column name
            subtotal_price: Number(order.subtotal_price ?? 0),
            total_tax: Number(order.total_tax ?? 0),
            total_shipping_price: Number(shipMoney.amount ?? 0),   // REST nests shipping in a money set
            total_discounts: Number(order.total_discounts ?? 0),
            customer_id: String((order.customer as Record<string, unknown> | null)?.id ?? ''),
            email: order.email ?? '',
            country_code: shipAddr.country_code ?? '',
            // attribution / referral — UTM lives in landing_site; codes = coupon/referral codes used
            source_name: order.source_name ?? '',
            landing_site: order.landing_site ?? '',
            referring_site: order.referring_site ?? '',
            discount_codes: codes.map((c) => String((c as Record<string, unknown>).code ?? '')).filter(Boolean),
            tags,
            line_items_count: lineItems.length,
            test: order.test ? 1 : 0,
          }
        }),
        nextCursor,
      }
    }

    if (job.dataType === 'products') {
      const url = productsUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const products = (body.products as Record<string, unknown>[]) ?? []
      return {
        rows: products.map((product) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(product),
          product_id: String(product.id),
          title: product.title ?? '',
          vendor: product.vendor ?? '',
          product_type: product.product_type ?? '',
          status: product.status ?? '',
          created_at: product.created_at,
          updated_at: product.updated_at,
        })),
        nextCursor,
      }
    }

    if (job.dataType === 'customers') {
      const url = customersUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const customers = (body.customers as Record<string, unknown>[]) ?? []
      return {
        rows: customers.map((c) => {
          const addr = (c.default_address as Record<string, unknown> | null) ?? {}
          const emc = (c.email_marketing_consent as Record<string, unknown> | null) ?? {}
          const tags = typeof c.tags === 'string' && c.tags ? c.tags.split(', ') : []
          return {
            tenant_id: job.tenantId,
            connection_id: job.connectionId,
            raw: JSON.stringify(c),
            customer_id: String(c.id),
            customer_gid: c.admin_graphql_api_id ?? '',
            email: c.email ?? '',          // usually redacted (Protected Customer Data)
            phone: c.phone ?? '',
            first_name: c.first_name ?? '',
            last_name: c.last_name ?? '',
            state: c.state ?? '',
            country_code: addr.country_code ?? '',
            province: addr.province ?? '',
            city: addr.city ?? '',
            verified_email: c.verified_email ? 1 : 0,
            tax_exempt: c.tax_exempt ? 1 : 0,
            number_of_orders: Number(c.orders_count ?? 0),
            amount_spent: Number(c.total_spent ?? 0),
            amount_spent_currency: c.currency ?? '',
            email_marketing_state: emc.state ?? '',
            tags,
            created_at: c.created_at,
            updated_at: c.updated_at,
          }
        }),
        nextCursor,
      }
    }

    // Line items live inside the orders payload — re-fetch orders and flatten one row per line.
    if (job.dataType === 'order_line_items') {
      const url = ordersUrl(shopUrl, job.since, job.until, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const orders = (body.orders as Record<string, unknown>[]) ?? []
      const rows = orders.flatMap((order) => {
        const items = (order.line_items as Record<string, unknown>[]) ?? []
        return items.map((li) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(li),
          order_id: String(order.id),
          order_created_at: order.created_at,
          line_item_id: String(li.id),
          product_id: String(li.product_id ?? ''),
          variant_id: String(li.variant_id ?? ''),
          title: li.title ?? '',
          sku: li.sku ?? '',
          vendor: li.vendor ?? '',
          quantity: Number(li.quantity ?? 0),
          current_quantity: Number(li.current_quantity ?? li.quantity ?? 0),
          price: Number(li.price ?? 0),
          total_discount: Number(li.total_discount ?? 0),
          taxable: li.taxable ? 1 : 0,
          requires_shipping: li.requires_shipping ? 1 : 0,
        }))
      })
      return { rows, nextCursor }
    }

    // Variants live inside the products payload — re-fetch products and flatten one row per variant.
    if (job.dataType === 'product_variants') {
      const url = productsUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const products = (body.products as Record<string, unknown>[]) ?? []
      const rows = products.flatMap((product) => {
        const variants = (product.variants as Record<string, unknown>[]) ?? []
        return variants.map((v) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(v),
          variant_id: String(v.id),
          product_id: String(v.product_id ?? product.id),
          title: v.title ?? '',
          sku: v.sku ?? '',
          barcode: v.barcode ?? '',
          inventory_item_id: String(v.inventory_item_id ?? ''),
          price: Number(v.price ?? 0),
          compare_at_price: Number(v.compare_at_price ?? 0),
          position: Number(v.position ?? 0),
          inventory_quantity: Number(v.inventory_quantity ?? 0),
          inventory_policy: v.inventory_policy ?? '',
          taxable: v.taxable ? 1 : 0,
          created_at: v.created_at,
          updated_at: v.updated_at,
        }))
      })
      return { rows, nextCursor }
    }

    // Coupon/referral code definitions (value, usage limit, window).
    if (job.dataType === 'price_rules') {
      const { body, nextCursor } = await shopifyFetch(simpleUrl(shopUrl, 'price_rules', job.cursor), job.credentials.accessToken)
      const rules = (body.price_rules as Record<string, unknown>[]) ?? []
      return {
        rows: rules.map((pr) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(pr),
          price_rule_id: String(pr.id),
          title: pr.title ?? '',
          target_type: pr.target_type ?? '',
          target_selection: pr.target_selection ?? '',
          allocation_method: pr.allocation_method ?? '',
          value_type: pr.value_type ?? '',
          value: Number(pr.value ?? 0),                // negative for discounts
          once_per_customer: pr.once_per_customer ? 1 : 0,
          usage_limit: Number(pr.usage_limit ?? 0),
          customer_selection: pr.customer_selection ?? '',
          starts_at: pr.starts_at ?? undefined,
          ends_at: pr.ends_at ?? undefined,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
        })),
        nextCursor,
      }
    }

    // Discount codes live UNDER price rules — fan out over a page of rules and
    // flatten their codes. Cursor advances the price_rules pages.
    if (job.dataType === 'discount_codes') {
      const { body, nextCursor } = await shopifyFetch(simpleUrl(shopUrl, 'price_rules', job.cursor), job.credentials.accessToken)
      const rules = (body.price_rules as Record<string, unknown>[]) ?? []
      const rows: Record<string, unknown>[] = []
      for (const rule of rules) {
        // Drain every code for this rule — bulk-generated rules can exceed one page.
        let dcCursor: string | undefined
        do {
          const params = new URLSearchParams({ limit: '250' })
          if (dcCursor) params.set('page_info', dcCursor)
          const url = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${rule.id}/discount_codes.json?${params}`
          const { body: dc, nextCursor: dcNext } = await shopifyFetch(url, job.credentials.accessToken)
          const codes = (dc.discount_codes as Record<string, unknown>[]) ?? []
          for (const c of codes) {
            rows.push({
              tenant_id: job.tenantId,
              connection_id: job.connectionId,
              raw: JSON.stringify(c),
              discount_code_id: String(c.id),
              price_rule_id: String(c.price_rule_id ?? rule.id),
              code: c.code ?? '',
              usage_count: Number(c.usage_count ?? 0),
              created_at: c.created_at,
              updated_at: c.updated_at,
            })
          }
          dcCursor = dcNext
        } while (dcCursor)
      }
      return { rows, nextCursor }
    }

    // Marketing events — UTM campaigns / activities (attribution source).
    if (job.dataType === 'marketing_events') {
      const { body, nextCursor } = await shopifyFetch(simpleUrl(shopUrl, 'marketing_events', job.cursor), job.credentials.accessToken)
      const events = (body.marketing_events as Record<string, unknown>[]) ?? []
      return {
        rows: events.map((e) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(e),
          marketing_event_id: String(e.id),
          event_type: e.event_type ?? '',
          marketing_channel: e.marketing_channel ?? '',
          paid: e.paid ? 1 : 0,
          budget: Number(e.budget ?? 0),
          currency: e.currency ?? '',
          utm_campaign: e.utm_campaign ?? '',
          utm_source: e.utm_source ?? '',
          utm_medium: e.utm_medium ?? '',
          started_at: e.started_at ?? undefined,
          ended_at: e.ended_at ?? undefined,
        })),
        nextCursor,
      }
    }

    // Abandoned checkouts — carts that never converted (recovery value).
    if (job.dataType === 'abandoned_checkouts') {
      const { body, nextCursor } = await shopifyFetch(checkoutsUrl(shopUrl, job.since, job.until, job.cursor), job.credentials.accessToken)
      const checkouts = (body.checkouts as Record<string, unknown>[]) ?? []
      return {
        rows: checkouts.map((co) => {
          const items = (co.line_items as unknown[] | null) ?? []
          return {
            tenant_id: job.tenantId,
            connection_id: job.connectionId,
            raw: JSON.stringify(co),
            checkout_id: String(co.id),
            token: co.token ?? '',
            email: co.email ?? '',
            customer_id: String((co.customer as Record<string, unknown> | null)?.id ?? ''),
            currency: co.currency ?? '',
            subtotal_price: Number(co.subtotal_price ?? 0),
            total_tax: Number(co.total_tax ?? 0),
            total_price: Number(co.total_price ?? 0),
            line_items_count: items.length,
            recovery_url: co.abandoned_checkout_url ?? '',
            completed_at: co.completed_at ?? undefined,
            created_at: co.created_at,
            updated_at: co.updated_at,
          }
        }),
        nextCursor,
      }
    }

    throw new Error(`Shopify connector: unsupported dataType "${job.dataType}"`)
  },

  // Expiring offline tokens die after ~60min. Trade the 90-day refresh_token for a
  // fresh access_token via grant_type=refresh_token. Shopify ROTATES the refresh_token
  // on each call, so the caller MUST persist the returned refreshToken atomically.
  async refreshCredentials(creds: ConnectorCredentials): Promise<ConnectorCredentials> {
    const shopUrl = creds.extra?.shop_url
    if (!shopUrl) throw new Error('Shopify refresh requires credentials.extra.shop_url')
    if (!creds.refreshToken) throw new Error('Shopify refresh requires a refresh_token')

    const res = await fetch(`https://${shopUrl}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID!,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`Shopify token refresh failed: ${res.status} ${await res.text()}`)
    const token = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      refresh_token_expires_in?: number
    }
    const nowSec = Math.floor(Date.now() / 1000)
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? creds.refreshToken, // rotated — keep the new one
      expiresAt: token.expires_in ? nowSec + token.expires_in : undefined,
      extra: {
        ...creds.extra,
        ...(token.refresh_token_expires_in
          ? { refresh_token_expires_at: String(nowSec + token.refresh_token_expires_in) }
          : {}),
      },
    }
  },
}
