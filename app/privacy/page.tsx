// app/privacy/page.tsx
export const metadata = {
  title: 'Privacy Policy — Connext',
  description: 'Connext 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-muted-foreground">최종 업데이트: 2026년 6월 23일</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
        <p>
          Connext(이하 &ldquo;서비스&rdquo;)는 사용자가 연결한 광고·커머스 채널
          (Meta Ads, Instagram, Shopify, Google Analytics, Cafe24 등)의 데이터를
          사용자를 대신해 수집·분석하여 통합 리포트를 제공합니다. 본 방침은 서비스가
          어떤 정보를 어떻게 처리하는지 설명합니다.
        </p>

        <section>
          <h2 className="mb-2 text-base font-medium">1. 수집하는 정보</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>계정 인증 정보: 사용자가 연결을 승인한 채널의 OAuth 액세스 토큰 (암호화 저장)</li>
            <li>채널 데이터: 광고 캠페인·성과 지표, 주문·상품·고객 데이터, 트래픽 통계 등 사용자가 승인한 범위의 데이터</li>
            <li>계정 정보: 이메일 주소, 팀/브랜드명</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">2. 이용 목적</h2>
          <p className="text-muted-foreground">
            수집한 데이터는 오직 사용자에게 통합 대시보드와 분석 리포트를 제공하기 위한
            목적으로만 처리됩니다. 그 외의 목적으로 사용하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">3. 제3자 제공</h2>
          <p className="text-muted-foreground">
            서비스는 수집한 데이터를 제3자에게 판매하거나 제공하지 않습니다. 데이터는
            사용자 본인의 분석 목적으로만 사용되며, 인프라(Supabase, ClickHouse 등) 외부로
            공유되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">4. 보관 및 파기</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>데이터는 사용자가 채널 연결을 유지하는 동안 보관됩니다.</li>
            <li>채널 연결을 해제하거나 계정을 삭제하면 관련 데이터는 파기됩니다.</li>
            <li>
              삭제 요청 방법은 <a href="/data-deletion" className="underline underline-offset-4 hover:text-foreground">데이터 삭제 안내</a> 페이지를 참고하세요.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">5. 보안</h2>
          <p className="text-muted-foreground">
            인증 토큰은 암호화하여 저장하며, 테넌트(고객)별로 데이터를 행 수준 보안(RLS)으로
            격리하여 다른 사용자가 접근할 수 없도록 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">6. 문의</h2>
          <p className="text-muted-foreground">
            개인정보 처리에 관한 문의: <a href="mailto:dhkim77000@daum.net" className="underline underline-offset-4 hover:text-foreground">dhkim77000@daum.net</a>
          </p>
        </section>
      </div>
    </main>
  )
}
