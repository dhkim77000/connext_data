import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Connext',
  description: 'Multi-tenant SaaS data platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
