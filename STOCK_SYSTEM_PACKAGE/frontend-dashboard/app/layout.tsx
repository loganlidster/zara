import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RAAS Tracking System',
  description: 'Really Amazing Asset Tracking - Event-based trading analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}