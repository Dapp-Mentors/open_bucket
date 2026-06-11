'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSiaStatus } from '@/lib/api'
import type { SiaStatus } from '@/types'
import { Layers, Upload, Wifi, WifiOff } from 'lucide-react'

interface NavProps {
  onUploadClick: () => void
}

export default function Nav({ onUploadClick }: NavProps) {
  const [sia, setSia] = useState<SiaStatus | null>(null)

  useEffect(() => {
    getSiaStatus().then(setSia)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-navy-700/60 bg-navy-900/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-aqua-600/20 border border-aqua-600/30 group-hover:border-aqua-500/60 transition-colors">
            <Layers className="h-4 w-4 text-aqua-400" />
          </span>
          <span className="font-semibold tracking-tight text-slate-100">
            Open<span className="text-aqua-400">Bucket</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Sia connection badge */}
          {sia && (
            <span className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${
              sia.connected
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                : 'text-amber-400 border-amber-500/30 bg-amber-500/5'
            }`}>
              {sia.connected
                ? <Wifi className="h-3 w-3" />
                : <WifiOff className="h-3 w-3" />
              }
              {sia.connected ? 'Sia live' : 'Demo mode'}
            </span>
          )}

          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white transition-colors shadow-aqua-glow"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </div>
    </header>
  )
}
