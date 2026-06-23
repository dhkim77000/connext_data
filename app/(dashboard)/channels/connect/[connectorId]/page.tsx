import Link from 'next/link'
import { redirect } from 'next/navigation'

type ConnectorGuide = {
  label: string
  tagline: string
  dataTypes: string[]
  steps: string[]
  permissions: string[]
  prerequisite?: string
  oauthPath: string
  needsShop?: boolean
}

const CONNECTOR_INFO: Record<string, ConnectorGuide> = {
  shopify: {
    label: 'Shopify',
    tagline: '스토어의 주문·상품·고객 데이터를 connext로 가져옵니다.',
    dataTypes: ['주문', '상품', '고객', '매출'],
    steps: [
      '스토어 주소 입력 (예: yourstore)',
      'Shopify 로그인 후 권한 허용',
      '데이터가 자동으로 동기화됩니다',
    ],
    permissions: ['주문 읽기', '상품 읽기', '고객 읽기'],
    prerequisite: 'Shopify 스토어 관리자 계정이 필요합니다.',
    oauthPath: '/api/oauth/shopify',
    needsShop: true,
  },
  meta_ads: {
    label: 'Meta Ads',
    tagline: '광고 캠페인 성과와 인사이트를 가져옵니다.',
    dataTypes: ['캠페인', '광고 성과', '노출·클릭', '지출'],
    steps: [
      'Facebook 계정으로 로그인',
      '광고 계정 읽기 권한 허용',
      '캠페인·성과 데이터가 동기화됩니다',
    ],
    permissions: ['광고 데이터 읽기 (ads_read)', '성과 인사이트 읽기 (read_insights)'],
    prerequisite: '광고 계정 관리자 권한이 있어야 합니다.',
    oauthPath: '/api/oauth/meta',
  },
  instagram: {
    label: 'Instagram',
    tagline: '게시물·좋아요·팔로워·도달 등 인스타그램 인사이트를 가져옵니다.',
    dataTypes: ['게시물', '좋아요·댓글', '팔로워', '도달·노출'],
    steps: [
      'Facebook 계정으로 로그인',
      '인스타그램 비즈니스 계정 권한 허용',
      '게시물·인사이트가 동기화됩니다',
    ],
    permissions: ['게시물·프로필 읽기 (instagram_basic)', '인사이트 읽기 (instagram_manage_insights)'],
    prerequisite: '인스타그램 비즈니스/크리에이터 계정이 Facebook 페이지에 연결돼 있어야 합니다.',
    oauthPath: '/api/oauth/instagram',
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
    <div className="max-w-2xl">
      <Link
        href="/channels"
        className="text-sm text-muted-foreground transition-colors hover:text-clay"
      >
        ← 채널
      </Link>

      <p className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-clay">
        채널 연결
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{info.label}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{info.tagline}</p>

      {/* what data — inline chips, not cards */}
      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          가져오는 데이터
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {info.dataTypes.map((d) => (
            <span
              key={d}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* how it works — numbered steps, clay markers */}
      <section className="mt-9">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          이렇게 연결돼요
        </p>
        <ol className="mt-4 space-y-4">
          {info.steps.map((s, i) => (
            <li key={i} className="flex gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay/12 font-mono text-xs font-medium text-clay">
                {i + 1}
              </span>
              <span className="text-sm leading-7">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* permissions — read only */}
      <section className="mt-9">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          요청하는 권한 · 읽기 전용
        </p>
        <ul className="mt-3 space-y-1.5">
          {info.permissions.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
              {p}
            </li>
          ))}
        </ul>
        {info.prerequisite && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{info.prerequisite}</p>
        )}
      </section>

      {/* action */}
      <section className="mt-10 border-t border-border pt-8">
        {info.needsShop ? (
          <form action={info.oauthPath} method="GET" className="space-y-3">
            <label className="block text-sm font-medium">Shopify 스토어 주소</label>
            <div className="flex items-center gap-2">
              <input
                name="shop"
                type="text"
                placeholder="yourstore"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                required
              />
              <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">
                .myshopify.com
              </span>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-clay px-4 py-2.5 text-sm font-medium text-clay-foreground transition-opacity hover:opacity-90"
            >
              {info.label} 연결하기
            </button>
          </form>
        ) : (
          <a
            href={info.oauthPath}
            className="block w-full rounded-md bg-clay px-4 py-2.5 text-center text-sm font-medium text-clay-foreground transition-opacity hover:opacity-90"
          >
            {info.label} 연결하기
          </a>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          연결 시 데이터는 암호화되어 저장되며 언제든 해제할 수 있어요.
        </p>
      </section>
    </div>
  )
}
