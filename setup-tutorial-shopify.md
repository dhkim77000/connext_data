# Tutorial: Shopify 앱 개발자 셋업

(데이터 호출은 [shopify.md](./shopify.md))

> ⚠️ **2026 큰 변경:**
> 1. **2026-01-01부로 admin "Develop apps"에서 신규 커스텀 앱 생성 불가** (기존 앱은 계속 동작). 단일 스토어 연동은 이제 **Dev Dashboard + client credentials grant**로.
> 2. Partner Dashboard → **새 Dev Dashboard**(`dev.shopify.com/dashboard`)로 앱 생성/설정 이동.
> 3. **Shopify managed installation이 기본**, 임베디드 앱은 **token exchange** 권장. 옛날 `shpat_` 영구 토큰은 레거시.

---

## 경우 A. 단일 스토어 서버 연동 (UI 없음) — Dev Dashboard + client credentials

옛 admin 커스텀 앱의 현대적 대체. 같은 조직 내 스토어일 때.

1. https://dev.shopify.com/dashboard → 좌측 **Apps** → **Create app** → **Start from Dev Dashboard** → 이름 → Create.
2. **Versions 탭:** App URL(임베디드 아니면 `https://shopify.dev/apps/default-app-home`) + Webhooks API 버전(최신) + **access scopes** 입력 → **Release**. (앱 설치 전 버전 1개 필요)
3. **Home → Install app** → 스토어 선택/생성 → Install.
4. **Settings**에서 **Client ID / Client secret** 복사 → 토큰 교환:
```bash
curl -X POST "https://{shop}.myshopify.com/admin/oauth/access_token" \
  -d "grant_type=client_credentials" \
  -d "client_id=${CLIENT_ID}" -d "client_secret=${CLIENT_SECRET}"
# -> { access_token, scope, expires_in: 86399 }  # 24시간 만료, 프로그램으로 재발급
```
⚠️ 앱과 스토어가 **같은 조직**이어야 함. 옛 admin에서 만든 dev store는 `shop_not_permitted` 에러 → Dev Dashboard의 **Dev stores**에서 생성.

## 경우 B. 임베디드/앱스토어 앱 — Shopify CLI (권장)

```bash
shopify app init        # 이름 입력, "Build a React Router app" 템플릿 권장
cd my-new-app
shopify app dev         # 로그인 + Dev Dashboard에 앱 자동 등록 + Cloudflare 터널(HTTPS) + dev store 설치
shopify app deploy      # 프로덕션에 config/익스텐션 배포 (config push는 폐지)
```
`shopify.app.toml` 핵심:
```toml
client_id = "..."
application_url = "https://www.app.example.com/"
embedded = true
[access_scopes]
scopes = "read_orders,write_customers"     # managed install이 이걸 요청
[auth]
redirect_urls = ["https://app.example.com/api/auth/callback"]
[webhooks]
api_version = "2026-04"
```
- **Managed install(기본):** TOML에 scope 선언 + `deploy`만 하면 Shopify가 설치/스코프 변경 처리(리디렉션 없음).
- **Token exchange(임베디드):** App Bridge가 세션 토큰(JWT) 발급 → 백엔드가 `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`로 access token 교환. CLI 스타터에 구현돼 있음.

## STEP: Partner 계정 (배포·보호 데이터)
- `partners.shopify.com` 가입 — **공개 배포·수익분배·앱스토어**에 필요. Client ID/Secret은 Dev Dashboard Settings에서.
- **배포 방식(1회 선택, 변경 불가):** Partner Dashboard → App distribution →
  - **Public**(앱스토어, 심사 필요) / **Custom**(단일 스토어 또는 같은 Plus 조직, 설치 링크, 심사 없음)

## API 버전 & 스코프
- 분기별 날짜 버전, 현재 **`2026-04`**, 각 ≥12개월 지원. URL: `/admin/api/2026-04/graphql.json`.
- 스코프: `read_orders`, `write_products`, `read_customers`, `read_inventory`, `read_fulfillments` 등. write가 read 포함.

## 심사 / 보호 고객 데이터
- **Public 앱 = 앱스토어 심사 필요, Custom 앱 = 심사 없음.**
- 앱스토어 앱은 **compliance webhooks**(`customers/redact`, `customers/data_request`, `shop/redact`) 필수.
- **보호 고객 데이터:** Level 0(없음) / Level 1(PII 제외) / Level 2(이름·주소·전화·이메일). Public은 Level 1·2 모두 심사, Custom은 둘 다 즉시 가능.

## 결정 가이드
- 단일 스토어·UI 없음·같은 조직 → **client credentials grant**
- 임베디드/앱스토어 → **CLI + managed install + token exchange**
- 한 Plus 조직에 사설 배포 → custom distribution(설치 링크, 심사 없음)
- 다수 머천트 판매 → public + 앱스토어 심사 (+PII면 보호데이터 승인)
