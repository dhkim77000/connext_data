# Tutorial: TikTok 개발자 셋업 (3개 플랫폼)

⚠️ TikTok은 **완전히 분리된 3개 개발자 생태계**. 앱·키·심사가 서로 호환되지 않는다. (데이터 호출은 [tiktok.md](./tiktok.md))

| 플랫폼 | 포털 | 자격증명 | 용도 |
| --- | --- | --- | --- |
| TikTok for Developers | developers.tiktok.com | **Client key / Client secret** | 로그인, 유저 콘텐츠 읽기/게시 |
| Marketing API | ads.tiktok.com/marketing_api | **App ID / Secret** | 광고계정·캠페인·리포팅 |
| TikTok Shop Partner | partner.tiktokshop.com | **App Key / Secret / Service ID** | 커머스(주문·상품·배송) |

---

## 플랫폼 1 — TikTok for Developers (오가닉/유저)

1. **가입:** https://developers.tiktok.com/signup → **Organization 생성 권장**(개인 계정 직접 등록은 비권장).
2. **앱 생성:** 프로필 → **Manage apps** → **Connect an app** → 소유자(조직) 선택.
3. **키 위치:** 앱 → App details → **Credentials**에 Client key / Client secret.
4. **Basic info:** 앱 아이콘(1024×1024), 이름, 설명(동의 화면에 노출), Platforms(Web/iOS/Android).
5. **제품 추가:** Products → Add products → Login Kit / Display API / Content Posting API 등.
   - **Login Kit:** Redirect URI 설정 (Android=App Link, iOS=Universal Link).
   - **Content Posting:** Direct Post 설정 활성화.
6. **스코프:** `user.info.basic`(기본), `user.info.profile`, `user.info.stats`, `video.list`, `video.publish`, `video.upload`. (2025년 user-info 스코프 세분화됨)
7. **샌드박스:** 앱에서 Production↔Sandbox 토글 → Create Sandbox → **타깃 유저 최대 10명** 추가(앱당 샌드박스 5개). ⚠️ 샌드박스에서 게시한 콘텐츠는 무조건 비공개.
8. **URL 소유권 검증:** URL properties → Verify (도메인/URL prefix). 2024-09 이후 앱은 ToS·개인정보·웹 URL 검증 필수.
9. **앱 리뷰 제출:** 각 제품·스코프 사용법 설명 + **데모 영상**(모든 스코프 커버) 업로드 → 제출 (~5-10영업일).
10. ⚠️ **`video.publish` 별도 감사:** 앱 리뷰와 별개. https://developers.tiktok.com/application/content-posting-api 에서 감사 통과 전까지 게시물은 **전부 비공개**.

## 플랫폼 2 — Marketing API (광고)

1. **가입:** https://ads.tiktok.com/marketing_api/homepage → Register → SMS 인증.
2. **Become a Developer:** 유형 선택(예: Direct Advertiser) → 이메일·전화 인증 → 회사 정보.
3. **앱 생성:** Create Application → 앱 이름/설명 + **Advertiser redirect URL**(OAuth 콜백, 인증 시 정확히 일치) + 권한 선택 → 승인 ~2-3영업일.
4. **키 위치:** My Apps → 앱 클릭 → **App ID / Secret** + Authorized URL.
5. **광고주 인증(OAuth):** Authorized URL 열기 → 광고계정 로그인·승인 → 콜백에 `auth_code` → `POST .../open_api/v1.3/oauth2/access_token/`(app_id+auth_code+secret)로 토큰 교환 → `advertiser_ids` 반환.
6. **샌드박스:** sandbox advertiser 생성(SDK `sandbox=True`, base `sandbox-ads.tiktok.com/open_api`).
7. **프로덕션 심사:** 앱 리뷰 + 비즈니스 검증 + **데이터 보안 감사**. (2025-2026 강화됨, 최소 권한만 신청 권장)
8. **Business Center** 전제: 통합 대상 광고주는 TikTok Business Center 필요.

## 플랫폼 3 — TikTok Shop Partner Center (커머스)

1. ⚠️ **포털 선택(1회만, 영구):**
   - 글로벌: https://partner.tiktokshop.com/ (비미국 법인/비미국 샵)
   - 미국: https://partner.us.tiktokshop.com/ (미국 법인/미국 샵)
2. **가입:** Get Started → **business region 선택(변경 불가)** → 타깃 마켓·카테고리 → 파트너 등록.
3. **앱 생성:** App & Service → Create app → 유형 선택:
   - **Public app**(앱스토어 배포) / **Custom app**(자체 샵·직접 배포)
4. **키 위치:** 앱 상세 → **App Key / App Secret / Service ID**.
5. **콜백/스코프:** Redirect/Callback URL + Webhook URL 설정 → 필요한 권한(상품·주문·배송·정산) **미리 전부 신청**(나중 추가 시 재심사).
6. **인증(OAuth):** App Key로 authorization URL 생성 → 셀러 로그인·승인 → 콜백 `code` → App Key+Secret+code로 access/refresh 토큰 교환. (인가는 최대 1년, 갱신 가능)
7. **샌드박스:** API Testing Tool로 테스트.
8. **프로덕션 심사:** 앱 리뷰 + **데이터 보안·개인정보 심사**(보안 정책·설문 10영업일 내 응답).

## 핵심
- 3개 등록 = 3개 키 세트. 호환 안 됨.
- 게시(플랫폼1)는 앱 리뷰 + Content Posting 감사 **둘 다** 통과해야 공개 게시.
- TikTok Shop **region은 영구** — 가장 신중할 1회 선택.
- 마케팅/Shop 포털 문서는 JS 렌더링이라 실제 브라우저로 열어야 함.
