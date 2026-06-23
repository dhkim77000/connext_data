'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="라이트/다크 전환"
      className="font-mono text-[11px] text-muted-foreground border border-border px-2.5 py-1.5 hover:text-foreground hover:border-cx-accent transition-colors"
    >
      <span suppressHydrationWarning>{dark ? 'LIGHT ○' : 'DARK ●'}</span>
    </button>
  )
}
