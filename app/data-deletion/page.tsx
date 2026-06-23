// app/data-deletion/page.tsx
export const metadata = {
  title: 'Data Deletion — Connext',
  description: 'Connext 데이터 삭제 안내',
}

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">데이터 삭제 안내</h1>
      <p className="mt-1 text-sm text-muted-foreground">최종 업데이트: 2026년 6월 23일</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
        <p>
          Connext에 수집된 데이터(연결한 채널의 광고·커머스 데이터 및 인증 토큰)의 삭제를
          요청하는 방법은 다음과 같습니다.
        </p>

        <section>
          <h2 className="mb-2 text-base font-medium">방법 1 — 채널 연결 해제 (즉시)</h2>
          <p className="text-muted-foreground">
            Connext 대시보드 → <span className="font-medium text-foreground">Channels</span> 페이지에서
            연결된 채널의 연결을 해제하면, 해당 채널에서 수집된 데이터와 저장된 인증 토큰이 삭제됩니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">방법 2 — 계정 전체 삭제</h2>
          <p className="text-muted-foreground">
            계정과 모든 연결 채널의 데이터를 삭제하려면
            {' '}<a href="mailto:dhkim77000@daum.net" className="underline underline-offset-4 hover:text-foreground">dhkim77000@daum.net</a>{' '}
            으로 가입 이메일을 명시하여 요청해 주세요.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">방법 3 — 이메일로 특정 데이터 삭제 요청</h2>
          <p className="text-muted-foreground">
            특정 채널 또는 데이터의 삭제를 원하시면
            {' '}<a href="mailto:dhkim77000@daum.net" className="underline underline-offset-4 hover:text-foreground">dhkim77000@daum.net</a>{' '}
            으로 삭제 대상을 명시하여 요청해 주세요. 영업일 기준 7일 이내에 처리하고 완료를 회신드립니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium">Meta / Instagram 데이터</h2>
          <p className="text-muted-foreground">
            Meta·Instagram 계정 연결을 해제하면 해당 플랫폼에서 가져온 데이터와 토큰이 함께
            삭제됩니다. Meta 계정 설정 → 비즈니스 통합에서 Connext의 접근 권한을 직접 철회할 수도 있습니다.
          </p>
        </section>
      </div>
    </main>
  )
}
