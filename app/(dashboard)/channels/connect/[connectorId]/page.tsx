import { redirect } from 'next/navigation'

const CONNECTOR_INFO: Record<string, { label: string; description: string; oauthPath: string; needsShop?: boolean }> = {
  shopify: {
    label: 'Shopify',
    description: 'Import orders, products, and customer data from your Shopify store.',
    oauthPath: '/api/oauth/shopify',
    needsShop: true,
  },
  meta_ads: {
    label: 'Meta Ads',
    description: 'Pull campaign performance and ad insights from Meta Ads Manager.',
    oauthPath: '/api/oauth/meta',
  },
}

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ connectorId: string }>
}) {
  const { connectorId } = await params
  const info = CONNECTOR_INFO[connectorId]
  if (!info) redirect('/channels')

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-1">Connect {info.label}</h1>
      <p className="text-sm text-muted-foreground mb-6">{info.description}</p>

      {info.needsShop ? (
        <form action={info.oauthPath} method="GET">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Shopify store URL</label>
            <div className="flex items-center gap-2">
              <input
                name="shop"
                type="text"
                placeholder="yourstore"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                required
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.myshopify.com</span>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Connect with {info.label}
          </button>
        </form>
      ) : (
        <a
          href={info.oauthPath}
          className="block w-full rounded-md bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Connect with {info.label}
        </a>
      )}
    </div>
  )
}
