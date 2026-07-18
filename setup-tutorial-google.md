# Tutorial: Google 개발자 셋업 (GA4 + YouTube)

GA4 Data API와 YouTube Data/Analytics API를 쓰기 위해 **우리(개발사)가 Google Cloud Console에서 해야 하는 일**. (데이터 호출 코드는 [ga4.md](./ga4.md), [youtube.md](./youtube.md) 참고)

> ⚠️ 2024~2025 큰 변경: **"OAuth 동의 화면"이 단일 페이지에서 사라지고 "Google Auth Platform"으로 이동**했습니다(`console.cloud.google.com/auth/...`). Branding / Audience / Clients / Data Access / Verification 페이지로 쪼개짐. 옛날 튜토리얼 스크린샷과 다릅니다.

---

## STEP 1. Google Cloud 프로젝트 생성
1. https://console.cloud.google.com 접속.
2. 상단 **프로젝트 선택기** → **새 프로젝트** → 이름 입력 → 만들기.
3. 만든 프로젝트를 선택(이후 모든 작업이 이 프로젝트에 적용).

## STEP 2. API 사용 설정 (Enable)
**메뉴(≡) → API 및 서비스 → 라이브러리**에서 검색 후 각각 **사용 설정**:
- **Google Analytics Data API** (GA4 리포팅)
- **Google Analytics Admin API** (GA4 설정 조회 시)
- **YouTube Data API v3**
- **YouTube Analytics API** (+ 대량 CSV는 YouTube Reporting API)

## STEP 3. OAuth 동의 화면 = Google Auth Platform
직접 이동: `https://console.cloud.google.com/auth/overview` → **시작하기(GET STARTED)**.
- **App Information:** 앱 이름 + 지원 이메일.
- **Audience(대상):** **External**(일반 구글 계정 전부) 또는 **Internal**(Workspace 조직 한정).
- **Contact Information** 입력 → 만들기.

생성 후 좌측 메뉴에서 세부 설정:
- **Branding:** 앱 이름·로고, **App Domain**(홈페이지·개인정보처리방침·약관 URL — 프로덕션 필수), Authorized domains.
- **Audience:** 게시 상태 = **Testing**(테스트 사용자 최대 100명, 동의 후 토큰 7일 만료) 또는 **In production**(게시).
- **Data Access:** **스코프 추가** — `analytics.readonly`, `youtube.readonly`, `yt-analytics.readonly`(수익은 `yt-analytics-monetary.readonly`). 모두 **민감(sensitive) 스코프**.

> 테스트 단계에서는 **Testing 모드 + 내 계정을 테스트 사용자로 추가**하면 심사 없이 바로 호출 가능. 외부 사용자에게 배포할 때만 검증 필요.

## STEP 4. 사용자 인증 정보(Credentials) 생성
**API 및 서비스 → 사용자 인증 정보**
- **OAuth 클라이언트 ID** → 유형 **웹 애플리케이션**:
  - **승인된 JavaScript 원본**: `https://app.example.com` (경로·끝슬래시 없이)
  - **승인된 리디렉션 URI**: `https://app.example.com/oauth2/callback` (정확히 일치해야 함)
  - 테스트는 `http://localhost:8080/callback` 허용.
  - 생성 후 client_id / client_secret JSON 다운로드.
- **API 키** (선택): YouTube 공개 데이터 읽기용. 생성 후 **API 제한**으로 YouTube Data API v3에만 묶기.

## STEP 5. (GA4) 서비스 계정 경로 — 사용자 OAuth 없이
백엔드에서 *내* GA4 속성을 읽을 때 권장. (YouTube Analytics는 서비스 계정 불가 → OAuth만)
1. **사용자 인증 정보 → 서비스 계정 만들기** → 이름 입력 → 완료.
2. 서비스 계정 → **키 탭 → 키 추가 → JSON** 다운로드(1회만).
3. 서비스 계정 이메일(`...@PROJECT.iam.gserviceaccount.com`) 복사.
4. **GA4 → 관리 → 속성 → 속성 액세스 관리 → + → 사용자 추가** → 그 이메일 붙여넣고 **뷰어(Viewer)** 권한 부여.

## STEP 6. 검증/감사 (프로덕션 배포 시)
- **브랜드 검증:** External 프로덕션 앱은 도메인(Search Console 인증) + 개인정보처리방침 필요.
- **민감 스코프 검증:** OAuth 플로우를 보여주는 데모 영상 + 사용 사례 제출. (Testing 모드면 불필요)
- **YouTube 쿼터 감사(별도):** 기본 10,000 units/일. 초과하려면 "YouTube API Services - Audit and Quota Extension Form" 제출.

## 자주 막히는 지점
| 증상 | 해결 |
| --- | --- |
| OAuth 동의 화면 메뉴가 안 보임 | `console.cloud.google.com/auth/overview`로 직접 이동 (이전됨) |
| 테스트 토큰이 7일 후 만료 | Testing 모드의 정상 동작 — 프로덕션 게시 또는 재인증 |
| GA4 서비스계정 추가 시 빨간 에러 | 대개 저장은 됨. 속성 액세스 관리에서 항목 보이는지 재확인 |
| YouTube search.list 쿼터 급소진 | 비용 100units/회 — 캐시, 루프 호출 금지, 감사로 증액 |
| API 키로 사용자 데이터 안 됨 | 사용자별 데이터(내 GA4/YT Analytics)는 OAuth/서비스계정 필요 |
