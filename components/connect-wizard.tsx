'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ConnectorMeta } from '@/lib/connectors-meta'

const CTA =
  'block w-full bg-primary px-4 py-3.5 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90'

function Glyph({ info }: { info: ConnectorMeta }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center font-mono text-lg font-semibold"
      style={{
        backgroundColor: `color-mix(in srgb, ${info.color} 16%, transparent)`,
        color: info.color,
      }}
      aria-hidden
    >
      {info.glyph}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {items.map((d) => (
        <span key={d} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
          {d}
        </span>
      ))}
    </div>
  )
}

function Intro({ info, multi, onNext }: { info: ConnectorMeta; multi: boolean; onNext: () => void }) {
  return (
    <div className="mt-8">
      <Glyph info={info} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{info.label} 연결하기</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        <span className="text-foreground">{info.brings}</span> 데이터를 한 곳에서 보게 돼요.
      </p>

      <p className="mt-7 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">가져오는 데이터</p>
      <Chips items={info.dataTypes} />

      <div className="mt-6 flex gap-3 border border-border bg-card p-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-primary" aria-hidden>
          <rect x="5" y="11" width="14" height="9" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <div>
          <p className="text-sm font-medium">읽기 전용이에요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            주문이나 게시물을 바꾸거나 글을 올리지 않아요. 데이터만 가져오고, 연결은 언제든 해제할 수 있어요.
          </p>
        </div>
      </div>

      {info.note && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">잠깐!</span> {info.note}
        </p>
      )}

      <div className="mt-7">
        {multi ? (
          <button onClick={onNext} className={CTA}>다음</button>
        ) : (
          <>
            <a href={info.oauthPath} className={CTA}>{info.label} 연결하기</a>
            <p className="mt-3 text-center text-[13px] text-muted-foreground">로그인하고 ‘허용’만 누르면 끝이에요.</p>
          </>
        )}
      </div>
    </div>
  )
}

function ShopStep({ info, onBack }: { info: ConnectorMeta; onBack: () => void }) {
  return (
    <form action={info.oauthPath} method="GET" className="mt-8">
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← 뒤로</button>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{info.inputLabel}</h1>
      <div className="mt-6 flex items-center gap-2">
        <input
          name={info.inputName}
          placeholder={info.inputPlaceholder}
          autoFocus
          required
          className="min-w-0 flex-1 border border-input bg-background px-3.5 py-3 text-[15px] outline-none transition-shadow focus:ring-2 focus:ring-ring"
        />
        <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">{info.inputSuffix}</span>
      </div>
      {info.inputHint && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{info.inputHint}</p>}
      <button type="submit" className={`${CTA} mt-7`}>연결하기</button>
    </form>
  )
}

function KeyStep({ info, onBack }: { info: ConnectorMeta; onBack: () => void }) {
  const n = info.fields?.length ?? 0
  return (
    <div className="mt-8">
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← 뒤로</button>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">키 {n}개만 받아오면 돼요</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">조금 더 복잡하지만, 순서대로 하면 금방이에요.</p>

      {info.helpSteps && (
        <ol className="mt-6 space-y-3">
          {info.helpSteps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-primary/12 font-mono text-xs font-medium text-primary">{i + 1}</span>
              <span className="text-sm leading-7">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {info.helpUrl && (
        <a href={info.helpUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80">
          발급 페이지 열기 ↗
        </a>
      )}

      <form action={info.oauthPath} method="GET" className="mt-7 space-y-4 border-t border-border pt-7">
        {info.fields?.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <label htmlFor={f.name} className="block text-sm font-medium">{f.label}</label>
            <input
              id={f.name}
              name={f.name}
              type={f.secret ? 'password' : 'text'}
              placeholder={f.placeholder}
              required
              className="w-full border border-input bg-background px-3.5 py-3 text-[15px] outline-none transition-shadow focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
        <button type="submit" className={CTA}>연결하기</button>
      </form>
      <p className="mt-3 text-center text-[13px] text-muted-foreground">입력한 키는 암호화되어 저장돼요.</p>
    </div>
  )
}

export function ConnectWizard({ info }: { info: ConnectorMeta }) {
  const [step, setStep] = useState(0)
  const multi = info.inputKind !== 'oauth'

  return (
    <div className="mx-auto max-w-md">
      <Link href="/channels" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← 채널
      </Link>

      {multi && (
        <div className="mt-6 flex gap-1.5" aria-hidden>
          <span className={`h-1 flex-1 ${step >= 0 ? 'bg-primary' : 'bg-border'}`} />
          <span className={`h-1 flex-1 ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
        </div>
      )}

      {step === 0 && <Intro info={info} multi={multi} onNext={() => setStep(1)} />}
      {step === 1 && (info.inputKind === 'shop' || info.inputKind === 'mall') && (
        <ShopStep info={info} onBack={() => setStep(0)} />
      )}
      {step === 1 && info.inputKind === 'apikey' && <KeyStep info={info} onBack={() => setStep(0)} />}
    </div>
  )
}
