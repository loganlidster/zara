import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tradiac Event Dashboard',
  description: 'Event-based trading analysis dashboard',
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