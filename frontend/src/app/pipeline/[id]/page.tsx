'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, FileText, Calendar, Weight, Hash, Link2 } from 'lucide-react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import PipelineStep from '@/components/pipeline/PipelineStep'
import UploadModal from '@/components/UploadModal'
import { useFilePoller } from '@/hooks/useFilePoller'
import { getFile } from '@/lib/api'
import { downloadUrl } from '@/lib/api'
import { formatBytes, statusColor, statusLabel, upsertLocalFile, loadLocalFiles } from '@/lib/storage'
import type { FileRecord } from '@/types'
import { PIPELINE_STEPS } from '@/types'

type StepState = 'pending' | 'active' | 'done' | 'error'

function getStepState(stepKey: string, file: FileRecord): StepState {
  const order = PIPELINE_STEPS.map((s) => s.key)
  const currentIdx = order.indexOf(file.status as typeof order[number])
  const stepIdx = order.indexOf(stepKey as typeof order[number])

  if (file.status === 'error') {
    return stepIdx < currentIdx ? 'done' : stepIdx === currentIdx ? 'error' : 'pending'
  }
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

export default function PipelinePage() {
  const params = useParams()
  const router = useRouter()
  const fileId = params.id as string

  const [file, setFile] = useState<FileRecord | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load from local storage first for instant paint
  useEffect(() => {
    const local = loadLocalFiles().find((f) => f.id === fileId)
    if (local) setFile(local)

    getFile(fileId)
      .then((r) => { setFile(r); upsertLocalFile(r) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fileId])

  const handleUpdate = useCallback((record: FileRecord) => {
    setFile(record)
    upsertLocalFile(record)
  }, [])

  const isTerminal = file?.status === 'ready' || file?.status === 'error'
  useFilePoller(isTerminal ? null : fileId, handleUpdate, 1500)

  if (loading && !file) {
    return (
      <>
        <Nav onUploadClick={() => setUploadOpen(true)} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 rounded-full border-2 border-aqua-500 border-t-transparent animate-spin" />
        </div>
      </>
    )
  }

  if (!file) {
    return (
      <>
        <Nav onUploadClick={() => setUploadOpen(true)} />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-slate-400">File not found.</p>
          <button onClick={() => router.push('/')} className="mt-4 text-aqua-400 text-sm hover:underline">
            Back to dashboard
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav onUploadClick={() => setUploadOpen(true)} />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Back + header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All files
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 border border-navy-700">
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-100 text-lg leading-tight">{file.name}</h1>
                <span className={`text-xs font-medium ${statusColor(file.status)}`}>
                  {statusLabel(file.status)}
                  {!isTerminal && ` · ${file.progress}%`}
                </span>
              </div>
            </div>

            {file.status === 'ready' && (
              <a
                href={downloadUrl(file.id)}
                download={file.name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-aqua-600 hover:bg-aqua-500 text-white text-sm font-medium transition-colors shadow-aqua-glow"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Pipeline steps — 3 cols */}
          <div className="lg:col-span-3">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-5">
              Pipeline
            </h2>

            <div className="rounded-2xl bg-navy-800 border border-navy-700/60 p-6">
              {PIPELINE_STEPS.map((step, i) => {
                const state = getStepState(step.key, file)
                return (
                  <PipelineStep
                    key={step.key}
                    label={step.label}
                    desc={step.desc}
                    state={state}
                    progress={state === 'active' ? file.progress : undefined}
                    timestamp={
                      state === 'done' && step.key === 'ready' && file.pinnedAt
                        ? format(new Date(file.pinnedAt), 'HH:mm:ss')
                        : state === 'done'
                        ? format(new Date(file.updatedAt), 'HH:mm:ss')
                        : undefined
                    }
                    isLast={i === PIPELINE_STEPS.length - 1}
                  />
                )
              })}
            </div>
          </div>

          {/* Metadata panel — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              Metadata
            </h2>

            <div className="rounded-2xl bg-navy-800 border border-navy-700/60 p-5 space-y-4">
              {[
                {
                  icon: Weight,
                  label: 'File size',
                  value: formatBytes(file.size),
                },
                {
                  icon: Calendar,
                  label: 'Uploaded',
                  value: format(new Date(file.createdAt), 'MMM d, yyyy HH:mm'),
                },
                {
                  icon: Hash,
                  label: 'Sia Object ID',
                  value: file.siaObjectId ?? '—',
                  mono: true,
                  truncate: true,
                },
                {
                  icon: Link2,
                  label: 'Indexd CID',
                  value: file.indexdCid ?? '—',
                  mono: true,
                  truncate: true,
                },
              ].map(({ icon: Icon, label, value, mono, truncate }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-700 border border-navy-600 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className={`text-sm text-slate-200 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`} title={value}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* MIME type + error if any */}
            <div className="rounded-xl bg-navy-800 border border-navy-700/60 px-4 py-3">
              <p className="text-xs text-slate-500">MIME type</p>
              <p className="text-sm text-slate-300 font-mono mt-0.5">{file.mimeType}</p>
            </div>

            {file.error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-xs text-red-400 font-medium">Error</p>
                <p className="text-sm text-red-300 mt-0.5">{file.error}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(id) => router.push(`/pipeline/${id}`)}
      />
    </>
  )
}
