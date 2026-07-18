# Tutorial: Business Suite + Page 만들고 기존 Instagram 연결하기

목표: 새 페이스북 계정으로 **비즈니스 포트폴리오 + 페이스북 페이지**를 만들고, **기존 인스타 계정**을 연결한 뒤, **API 테스트**까지 가능한 상태로 만든다.

> 왜 이 순서인가: Instagram Graph API(FB-Login 경로)로 데이터를 가져오려면 인스타가 **프로페셔널 계정**이고 **페이스북 페이지에 연결**돼 있어야 한다. 페이지를 담을 그릇이 **비즈니스 포트폴리오**다.

메뉴 이름은 Meta가 자주 바꾸므로 화면과 조금 다를 수 있다. 큰 흐름(포트폴리오 → 페이지 → 인스타 연결 → 앱 연결)만 기억하면 된다.

---

## STEP 0. 준비물 체크

- 새로 만든 **페이스북 계정** (로그인 상태)
- **기존 인스타 계정**의 로그인 정보
- 인스타가 **프로페셔널(비즈니스/크리에이터)** 계정인지 확인
  - 인스타 앱 → 프로필 → ☰ → 설정 및 개인정보 → **계정 유형 및 도구** → "프로페셔널 계정으로 전환" (이미 됐으면 건너뜀)

---

## STEP 1. 비즈니스 포트폴리오(Business Manager) 만들기

1. 데스크톱 브라우저에서 **https://business.facebook.com** 접속 → 새 페북 계정으로 로그인.
2. 포트폴리오가 없으면 생성 화면이 뜬다. (안 뜨면 좌측 하단 톱니 **설정** → 우상단 비즈니스 선택 → "새 비즈니스 포트폴리오 만들기")
3. 입력: **비즈니스 이름**, 내 이름, **업무용 이메일** → 만들기.
4. 메일함에서 **인증 메일 확인** 클릭.

> 팁: 이름은 나중에 바꿀 수 있으니 가볍게 시작. 광고 계정은 지금 안 만들어도 됨(나중에 추가 가능, 단 추가 후 삭제 불가).

---

## STEP 2. 페이스북 페이지 만들기

페이지는 인스타 연결의 "앵커"다. 두 방법 중 하나.

**방법 A — 비즈니스 설정 안에서 (권장)**
1. business.facebook.com → 좌측 하단 **설정(톱니)** → **비즈니스 설정**.
2. 좌측 메뉴 **계정 → 페이지** → 파란 **추가** 버튼 → **새 페이지 만들기**.
3. **페이지 이름** + **카테고리**(예: 브랜드, 소매업) 입력 → 만들기.

**방법 B — 페이지 직접 생성 후 포트폴리오에 추가**
1. https://www.facebook.com/pages/create 에서 페이지 생성.
2. 비즈니스 설정 → 계정 → 페이지 → 추가 → **기존 페이지 추가**로 포트폴리오에 편입.

---

## STEP 3. 기존 Instagram 계정 연결하기

> "계정 소유권 요청"이 무한 로딩이면 이 **연결(link)** 방식으로 우회한다. 연결만 돼도 API 테스트엔 충분하다.

**방법 A — 페이스북 페이지에서 연결 (가장 안정적)**
1. 만든 **페이지로 이동** → 페이지 **설정**.
2. **연결된 계정(Linked accounts)** → **Instagram** → **계정 연결**.
3. 팝업에서 **기존 인스타 계정으로 로그인** → 권한 허용.

**방법 B — 비즈니스 설정에서 연결**
1. 비즈니스 설정 → **계정 → Instagram 계정** → **추가** → **Instagram 계정 연결**.
2. 인스타 로그인 → 허용. (새 포트폴리오에선 기존에 막히던 게 풀리는 경우 많음)

**방법 C — 인스타 앱에서 (모바일)**
1. 인스타 앱 → 프로필 → ☰ → 설정 및 개인정보 → **비즈니스 도구 및 관리**.
2. 페이스북 페이지 연결 항목에서 위에서 만든 페이지 선택.

### 연결 확인
- 페이지 설정의 연결된 계정에 인스타 사용자명이 보이면 성공.
- API로도 확인 가능:
  ```bash
  curl -G "https://graph.facebook.com/v25.0/me/accounts" \
    --data-urlencode "fields=id,name,instagram_business_account" \
    --data-urlencode "access_token=${USER_TOKEN}"
  ```
  응답에 `instagram_business_account.id`가 있으면 연결 완료.

---

## STEP 4. 개발자 앱에 자산 연결 (API 테스트용)

1. **https://developers.facebook.com** → 내 앱(없으면 생성, 타입 **Business**) → **개발 모드** 유지.
2. 앱에 제품 추가: **Facebook Login for Business** + **Instagram**(Instagram Graph API).
3. 비즈니스 설정 → **계정 → 앱** → 추가 → 내 앱을 포트폴리오에 연결.
4. 내가 앱의 **관리자**인지 확인(개발 모드에선 내 계정 데이터는 심사 없이 접근 가능).

---

## STEP 5. 토큰 발급 + 데이터 테스트

1. **Graph API Explorer**: https://developers.facebook.com/tools/explorer
2. 내 앱 선택 → **Generate Access Token** → 스코프 체크:
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`
3. 발급된 토큰으로 테스트:

```bash
# 1) 페이지 + IG id 확인
curl -G "https://graph.facebook.com/v25.0/me/accounts" \
  --data-urlencode "fields=id,name,instagram_business_account" \
  --data-urlencode "access_token=${USER_TOKEN}"

# 2) 프로필
curl -G "https://graph.facebook.com/v25.0/${IG_ID}" \
  --data-urlencode "fields=username,followers_count,media_count" \
  --data-urlencode "access_token=${USER_TOKEN}"

# 3) 인사이트
curl -G "https://graph.facebook.com/v25.0/${IG_ID}/insights" \
  --data-urlencode "metric=reach,profile_views" \
  --data-urlencode "period=day" \
  --data-urlencode "access_token=${USER_TOKEN}"
```

`username`/`followers_count`가 나오면 전체 파이프라인 OK. 자세한 코드/에러 대응은 [instagram.md](./instagram.md) §6 참고.

---

## 자주 막히는 지점

| 증상 | 원인 / 해결 |
| --- | --- |
| "계정 소유권 요청" 무한 로딩 | 소유권 대신 **연결(link)** 방식으로 우회 (STEP 3). API엔 연결이면 충분 |
| `instagram_business_account` 필드가 안 옴 | 인스타가 개인 계정이거나 페이지에 미연결 → STEP 0, STEP 3 다시 |
| 토큰 권한 에러 (#10) | 토큰 재발급 시 `instagram_manage_insights` 스코프 체크 |
| 인사이트 빈 데이터 | 팔로워 100명 미만이거나 해당 기간 활동 없음 |
| 페이지에 인스타 연결 버튼이 안 보임 | 인스타를 먼저 프로페셔널 계정으로 전환 |
