# Tutorial: Google Ads API 개발자 셋업

호출에 필요한 4종 자격증명: **Developer Token + OAuth Client ID/Secret + Refresh Token + login-customer-id**. (데이터 호출은 [google-ads.md](./google-ads.md))

---

## STEP 1. 매니저 계정(MCC) 생성
API Center는 **매니저(MCC) 계정에만** 있으므로 먼저 만든다.
1. https://ads.google.com/home/tools/manager-accounts → **매니저 계정 만들기**.
2. ⚠️ **기존 Google Ads에 한 번도 안 쓴 이메일**로 가입(필수).
3. "다른 사람의 계정 관리" 선택 → 국가/시간대 설정 → 생성. (10자리 Customer ID 발급)

## STEP 2. Developer Token 신청 (API Center)
1. MCC → **도구 및 설정(렌치) → 설정 → API Center** (`https://ads.google.com/aw/apicenter`).
2. 신청서 작성: 회사명, **실제 동작하는 회사 URL**(test.com/example.com 거부), 모니터링 되는 연락 이메일, 사용 목적, 약관 동의.
3. 발급되는 액세스 레벨:
   - **Test**: 테스트 계정만, 15,000 ops/일
   - **Explorer**(2025+ 기본): 운영 계정 2,880 ops/일
   - **Basic**: 15,000 ops/일 (신청, ~5영업일)
   - **Standard**: 무제한 (Basic에서 신청, ~10영업일)

## STEP 3. OAuth 자격증명 + Refresh Token
스코프 1개: `https://www.googleapis.com/auth/adwords`
1. Google Cloud Console → 프로젝트 생성/선택 → 라이브러리에서 **Google Ads API** 사용 설정.
2. OAuth 동의 화면 구성(External, 본인 테스트 사용자 추가).
3. **사용자 인증 정보 → OAuth 클라이언트 ID**:
   - 서버/스크립트용은 **데스크톱 앱**(refresh token 기본 발급, 가장 간단)
   - OAuth Playground 쓸 거면 **웹 애플리케이션** + 리디렉션에 `https://developers.google.com/oauthplayground` 추가
4. **Refresh Token 발급** (만료 안 됨):
   - OAuth 2.0 Playground → 기어 아이콘 → 내 client_id/secret 입력 → `adwords` 스코프 인증 → code 교환
   - 또는 각 공식 클라이언트 라이브러리의 `generate_user_credentials` 샘플
5. `developer_token`, `client_id`, `client_secret`, `refresh_token`, `login_customer_id`를 `google-ads.yaml` 또는 env에 저장.

## STEP 4. login-customer-id & 클라이언트 계정 연결
- **login-customer-id** = 인증을 통과하는 **MCC의 10자리 ID(대시 없이)**. 헤더로 전송. 실제 작업 대상은 `customer_id`로 지정.
- 클라이언트 계정 연결: MCC → 계정 → 하위 계정 설정 → **기존 계정 연결** → 클라이언트 Customer ID 입력 → 클라이언트가 **관리자 탭에서 수락**.

## STEP 5. Basic → Standard 액세스 신청
- **Basic**: API Center에서 연락 이메일 최신화 + **모든 활성 계정을 MCC 하위에 연결** → "Apply for Basic Access" (~5영업일).
- **Standard**: Basic 상태에서 "Apply for Standard Access" (~10영업일). 무제한 필요한 대형/외부 도구용.
- 심사 체크: **명확한 사용 사례**, **광고주 검증(advertiser verification)**, (Standard) **RMF**용 데모 로그인 제공.
- ⚠️ 2026 초 신청 적체로 검토 장기화. Explorer로 충분하면 그대로 쓰라는 게 Google 권고.

## STEP 6. 테스트 계정으로 선개발
- 토큰 승인 전에도 **Test 계정**(빨간 "Test account" 표시)으로 15,000 ops/일 풀 사용 가능, 실제 광고 미게재.
- 테스트 MCC는 **새 이메일로 UI에서** 생성, 그 아래 테스트 클라이언트 생성.
- ⚠️ Developer Token 자체는 **운영(non-test) MCC**에서만 읽을 수 있음 → 토큰용 운영 MCC + 샌드박스용 테스트 MCC 분리.

## STEP 7. 버전 & 라이브러리
- 현재 **v24.x** (2026년 중반 기준), v23 지원. **2026-01부터 월간 릴리스**로 변경.
- 공식 클라이언트 라이브러리 사용(Python `pip install google-ads`).
- ⚠️ 기본 버전이 매달 바뀌므로 **클라이언트 생성 시 버전 명시 핀**(예: `version="v24"`).
