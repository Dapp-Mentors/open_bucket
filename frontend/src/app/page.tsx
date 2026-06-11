'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Database, Pin, LayoutGrid } from 'lucide-react'
import Nav from '@/components/Nav'
import FileCard from '@/components/FileCard'
import UploadModal from '@/components/UploadModal'
import HowItWorks from '@/components/HowItWorks'
import ToastContainer, { type ToastData } from '@/components/Toast'
import { listFiles } from '@/lib/api'
import { useFilePoller } from '@/hooks/useFilePoller'
import type { FileRecord } from '@/types'
import { v4 as uuid } from 'uuid'

export default function Dashboard() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [activePollId, setActivePollId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])

  // Load files from backend on mount
  useEffect(() => {
    listFiles().then((remote) => {
      if (remote.length) {
        setFiles(remote)
      }
    })
  }, [])

  const addToast = (type: ToastData['type'], message: string) => {
    const id = uuid()
    setToasts((t) => [...t, { id, type, message }])
  }

  const handleFileUpdate = useCallback((record: FileRecord) => {
    setFiles((prev) => {
      const next = [...prev]
      const idx = next.findIndex((f) => f.id === record.id)
      if (idx >= 0) next[idx] = record
      else next.unshift(record)
      return next
    })
    if (record.status === 'ready') {
      addToast('success', `"${record.name}" is pinned and ready.`)
      setActivePollId(null)
    }
    if (record.status === 'error') {
      addToast('error', `Failed to pin "${record.name}"`)
      setActivePollId(null)
    }
  }, [])

  useFilePoller(activePollId, handleFileUpdate)

  const handleUploaded = (fileId: string) => {
    setActivePollId(fileId)
    setExpandedId(fileId)
    addToast('info', 'Pipeline started — tracking progress…')
  }

  const handleDelete = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    addToast('info', 'File deleted successfully.')
  }, [])

  const ready  = files.filter((f) => f.status === 'ready').length
  const active = files.filter((f) => !['ready', 'error'].includes(f.status)).length

  return (
    <>
      <Nav onUploadClick={() => setUploadOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        {/* Hero */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-aqua-500 uppercase tracking-widest mb-2">
                Decentralized storage
              </p>
              <h1 className="text-3xl font-bold text-slate-100 leading-tight">
                Your files, encrypted<br />
                <span className="text-aqua-400">and distributed</span> by Sia.
              </h1>
              <p className="text-slate-400 mt-2 text-sm max-w-md">
                Each upload runs a live Inngest pipeline — erasure-coded shards, indexer pinning,
                Indexd metadata. Watch it happen right here.
              </p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-aqua-600 hover:bg-aqua-500 text-white font-medium transition-all shadow-aqua-glow hover:shadow-none shrink-0"
            >
              <Upload className="h-4 w-4" />
              Upload a file
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {[
            { icon: LayoutGrid, label: 'Total files', value: files.length },
            { icon: Pin,        label: 'Pinned',      value: ready },
            { icon: Database,   label: 'In pipeline', value: active },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-800 border border-navy-700/60"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700">
                <Icon className="h-4 w-4 text-aqua-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-100 leading-none">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* File list with inline accordion pipeline */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-300">My Files</h2>
              {active > 0 && (
                <span className="text-xs text-aqua-400 font-mono animate-pulse-slow">
                  {active} processing…
                </span>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {files.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-navy-700 py-16 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-800 border border-navy-700">
                    <Database className="h-7 w-7 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-medium">Nothing here yet</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Upload a file to see the Sia pipeline in action
                    </p>
                  </div>
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="px-4 py-2 text-sm rounded-lg bg-aqua-600/15 border border-aqua-600/30 text-aqua-400 hover:bg-aqua-600/25 transition-colors"
                  >
                    Upload your first file
                  </button>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-3">
                  {files.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      expanded={expandedId === f.id}
                      onToggle={(id) =>
                        setExpandedId((prev) => (prev === id ? null : id))
                      }
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <HowItWorks />

            <div className="rounded-xl border border-navy-700/60 bg-navy-800/50 p-4 space-y-3">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">Stack</p>
              {[
                ['Storage',  'Sia Network'],
                ['Events',   'Inngest'],
                ['Metadata', 'Indexd (simulated)'],
                ['Persistence', 'SQLite'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </>
  )
}