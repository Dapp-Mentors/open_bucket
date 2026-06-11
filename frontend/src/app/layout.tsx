import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpenBucket — Sia-powered file pinning',
  description: 'Upload, pin and share files on the Sia decentralized storage network',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-navy-900 grid-bg">
        {children}
      </body>
    </html>
  )
}
