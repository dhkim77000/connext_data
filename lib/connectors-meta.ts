// Friendly connector metadata — single source for the channels list + connect wizard.
// Plain-language copy only. NO raw OAuth scope names in anything user-facing.

export type InputKind = 'oauth' | 'shop' | 'mall' | 'apikey'
export type ConnectorGroup = '쇼핑몰' | '광고' | '소셜·콘텐츠' | '웹 분석'

export interface CredentialField {
  name: string
  label: string
  placeholder: string
  secret?: boolean
}

export interface ConnectorMeta {
  id: string
  label: string
  glyph: string
  color: string
  group: ConnectorGroup
  /** one-line plain benefit shown on the list card */
  brings: string
  /** data chips shown on the connect intro */
  dataTypes: string[]
  inputKind: InputKind
  oauthPath: string
  /** shop/mall input */
  inputLabel?: string
  inputPlaceholder?: string
  inputSuffix?: string
  inputName?: string
  inputHint?: string
  /** apikey channels */
  fields?: CredentialField[]
  helpUrl?: string
  helpSteps?: string[]
  /** short plain prerequisite, only when it truly matters */
  note?: string
}

export const CONNECTOR_GROUPS: ConnectorGroup[] = ['쇼핑몰', '광고', '소셜·콘텐츠', '웹 분석']

export const CONNECTORS: ConnectorMeta[] = [
  {
    id: 'shopify',
    label: 'Shopify',
    glyph: 'S',
    color: 'var(--ch-shopify)',
    group: '쇼핑몰',
    brings: '주문·매출·고객',
    dataTypes: ['주문', '상품', '고객', '매출'],
    inputKind: 'shop',
    oauthPath: '/api/oauth/shopify',
    inputLabel: '스토어 주소가 뭐예요?',
    inputPlaceholder: 'yourstore',
    inputSuffix: '.myshopify.com',
    inputName: 'shop',
    inputHint: "Shopify 관리자 주소 yourstore.myshopify.com 에서 'yourstore' 부분이에요.",
  },
  {
    id: 'meta_ads',
    label: 'Meta 광고',
    glyph: 'M',
    color: 'var(--ch-meta)',
    group: '광고',
    brings: '광고 성과·비용',
    dataTypes: ['캠페인', '광고 성과', '노출·클릭', '지출'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/meta',
    note: '광고 계정 관리자 권한이 있는 Facebook 계정으로 로그인하면 돼요.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    glyph: 'IG',
    color: '#C13584',
    group: '소셜·콘텐츠',
    brings: '게시물·팔로워·도달',
    dataTypes: ['게시물', '좋아요·댓글', '팔로워', '도달·노출'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/instagram',
    note: '인스타그램 프로페셔널(비즈니스/크리에이터) 계정이 Facebook 페이지에 연결돼 있어야 해요.',
  },
  {
    id: 'ga4',
    label: 'Google Analytics',
    glyph: 'GA',
    color: '#E8710A',
    group: '웹 분석',
    brings: '방문자·전환',
    dataTypes: ['세션', '사용자', '전환', '트래픽 소스'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/ga4',
  },
  {
    id: 'google_ads',
    label: 'Google 광고',
    glyph: 'Ad',
    color: '#3B82F6',
    group: '광고',
    brings: '검색·쇼핑 광고',
    dataTypes: ['캠페인', '클릭', '전환', '지출'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/google-ads',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    glyph: 'YT',
    color: 'var(--ch-youtube)',
    group: '소셜·콘텐츠',
    brings: '조회수·구독자',
    dataTypes: ['조회수', '구독자', '시청 시간', '인구통계'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/youtube',
  },
  {
    id: 'tiktok',
    label: 'TikTok 광고',
    glyph: 'TT',
    color: 'var(--ch-tiktok)',
    group: '광고',
    brings: '광고·영상 성과',
    dataTypes: ['캠페인', '영상 조회', '전환', '지출'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/tiktok',
  },
  {
    id: 'naver_search_ad',
    label: '네이버 검색광고',
    glyph: 'N',
    color: 'var(--ch-naver)',
    group: '광고',
    brings: '검색광고 성과',
    dataTypes: ['캠페인', '키워드', '노출·클릭', 'ROAS'],
    inputKind: 'apikey',
    oauthPath: '/api/connect/naver-search-ad',
    helpUrl: 'https://searchad.naver.com',
    helpSteps: [
      '네이버 검색광고 → 도구 → API 사용 관리 열기',
      '"API 라이선스 발급" 으로 키 3개를 받기',
      '아래에 그대로 붙여넣기',
    ],
    fields: [
      { name: 'customerId', label: '고객 ID', placeholder: '1234567890' },
      { name: 'apiKey', label: 'API 키', placeholder: '발급받은 API 키' },
      { name: 'secretKey', label: '시크릿 키', placeholder: '발급받은 시크릿 키', secret: true },
    ],
  },
  {
    id: 'naver_commerce',
    label: '네이버 스마트스토어',
    glyph: 'N',
    color: 'var(--ch-naver)',
    group: '쇼핑몰',
    brings: '주문·정산',
    dataTypes: ['주문', '상품', '정산'],
    inputKind: 'apikey',
    oauthPath: '/api/oauth/naver-commerce',
    helpUrl: 'https://apicenter.commerce.naver.com',
    helpSteps: [
      'Commerce API Center에서 앱 등록하기',
      '클라이언트 ID·시크릿 받기',
      '아래에 붙여넣기',
    ],
    fields: [
      { name: 'clientId', label: '클라이언트 ID', placeholder: '발급받은 Client ID' },
      { name: 'clientSecret', label: '클라이언트 시크릿', placeholder: '발급받은 Client Secret', secret: true },
    ],
  },
  {
    id: 'kakao_moment',
    label: '카카오 모먼트',
    glyph: 'K',
    color: '#EAB308',
    group: '광고',
    brings: '카카오 광고',
    dataTypes: ['캠페인', '클릭', 'CTR', '지출'],
    inputKind: 'oauth',
    oauthPath: '/api/oauth/kakao-moment',
    note: '카카오 모먼트 API는 공식 대행사·사전 협의된 광고주만 쓸 수 있어요. 카카오 담당자에게 먼저 신청하세요.',
  },
  {
    id: 'cafe24',
    label: 'Cafe24',
    glyph: 'C',
    color: '#3B82F6',
    group: '쇼핑몰',
    brings: '주문·고객',
    dataTypes: ['주문', '상품', '고객', '정산'],
    inputKind: 'mall',
    oauthPath: '/api/oauth/cafe24',
    inputLabel: '카페24 몰 ID가 뭐예요?',
    inputPlaceholder: 'yourstore',
    inputSuffix: '.cafe24.com',
    inputName: 'mall',
    inputHint: "카페24 관리자 주소 yourstore.cafe24.com 에서 'yourstore' 부분이에요.",
  },
  {
    id: 'coupang',
    label: '쿠팡 WING',
    glyph: 'CP',
    color: '#EF4444',
    group: '쇼핑몰',
    brings: '주문·정산',
    dataTypes: ['주문', '상품', '반품', '정산'],
    inputKind: 'apikey',
    oauthPath: '/api/connect/coupang',
    helpUrl: 'https://wing.coupang.com',
    helpSteps: [
      'WING → 셀러 정보 → Open API Key 발급 신청',
      '키 발급에 최대 24시간 걸릴 수 있어요',
      '키를 받으면 아래에 붙여넣기',
    ],
    fields: [
      { name: 'vendorId', label: '벤더 ID', placeholder: 'A00012345' },
      { name: 'accessKey', label: '액세스 키', placeholder: '발급받은 Access Key' },
      { name: 'secretKey', label: '시크릿 키', placeholder: '발급받은 Secret Key', secret: true },
    ],
  },
]

export const getConnector = (id: string): ConnectorMeta | undefined =>
  CONNECTORS.find((c) => c.id === id)
