'use client'
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { FileText, Download, ChevronDown, Check, Clock, AlertCircle } from 'lucide-react'
import type { FileRecord } from '@/types'
import { PIPELINE_STEPS } from '@/types'
import { formatBytes, statusColor, statusLabel } from '@/lib/storage'
import { downloadUrl } from '@/lib/api'

interface FileCardProps {
  file: FileRecord
  expanded: boolean
  onToggle: (id: string) => void
}

const BAR_COLOR: Record<string, string> = {
  queued:    'bg-slate-500',
  uploading: 'bg-aqua-500',
  pinning:   'bg-violet-500',
  indexing:  'bg-yellow-500',
  ready:     'bg-emerald-500',
  error:     'bg-red-500',
}

type StepState = 'pending' | 'active' | 'done' | 'error'

function getStepState(fileStatus: string, stepKey: string, stepIdx: number): StepState {
  const curIdx = PIPELINE_STEPS.findIndex((s) => s.key === fileStatus)
  if (fileStatus === 'error') {
    if (stepIdx < curIdx) return 'done'
    if (stepIdx === curIdx) return 'error'
    return 'pending'
  }
  if (stepIdx < curIdx) return 'done'
  if (stepIdx === curIdx) return fileStatus === 'ready' ? 'done' : 'active'
  return 'pending'
}

function PipelineRow({
  step,
  state,
  progress,
  timestamp,
  isLast,
}: {
  step: (typeof PIPELINE_STEPS)[number]
  state: StepState
  progress?: number
  timestamp?: string
  isLast: boolean
}) {
  const dotClass = {
    pending: 'bg-navy-700 border-navy-600',
    active:  'bg-navy-800 border-aqua-500',
    done:    'bg-emerald-500/15 border-emerald-500/50',
    error:   'bg-red-500/15 border-red-500/50',
  }[state]

  const labelClass = {
    pending: 'text-slate-500',
    active:  'text-aqua-300',
    done:    'text-slate-200',
    error:   'text-red-300',
  }[state]

  return (
    <div className="flex gap-3">
      {/* Dot + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 ${dotClass}`}
        >
          {state === 'done'    && <Check className="h-3 w-3 text-emerald-400" />}
          {state === 'active'  && (
            <span className="h-2 w-2 rounded-full bg-aqua-400 animate-pulse" />
          )}
          {state === 'pending' && <Clock className="h-3 w-3 text-slate-600" />}
          {state === 'error'   && <AlertCircle className="h-3 w-3 text-red-400" />}
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1 min-h-[20px] bg-navy-600 overflow-hidden">
            {state === 'done' && (
              <motion.div
                className="w-full bg-emerald-500/40"
                initial={{ height: 0 }}
                animate={{ height: '100%' }}
                transition={{ duration: 0.45 }}
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-medium ${labelClass}`}>{step.label}</span>
          {timestamp && (
            <span className="text-xs text-slate-500 font-mono">{timestamp}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>

        {state === 'active' && typeof progress === 'number' && (
          <div className="mt-2 h-1 w-full rounded-full bg-navy-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-aqua-600 to-aqua-400"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        {state === 'done' && (
          <motion.div
            className="mt-2 h-1 w-full rounded-full bg-emerald-500/30"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </div>
    </div>
  )
}

export default function FileCard({ file, expanded, onToggle }: FileCardProps) {
  const isActive   = !['ready', 'error'].includes(file.status)
  const barColor   = BAR_COLOR[file.status] ?? 'bg-slate-500'
  const curStepIdx = PIPELINE_STEPS.findIndex((s) => s.key === file.status)
  const progress   = file.status === 'ready' ? 100 : PIPELINE_STEPS[curStepIdx]?.pct ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-navy-800 border border-navy-700/60 hover:border-navy-600 transition-colors overflow-hidden shadow-card"
    >
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-navy-700">
        <motion.div
          className={`h-full ${barColor}`}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Header row — clickable to toggle accordion */}
      <button
        onClick={() => onToggle(file.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-navy-700/30 transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-700 border border-navy-600 shrink-0">
          <FileText className="h-4 w-4 text-slate-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatBytes(file.size)} ·{' '}
            {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-aqua-400 animate-pulse" />
          )}
          <span className={`text-xs font-medium ${statusColor(file.status)}`}>
            {statusLabel(file.status)}
          </span>
          {isActive && (
            <span className="text-xs font-mono text-slate-500">{progress}%</span>
          )}
          {file.status === 'ready' && file.siaObjectId && (
            <span
              className="hidden sm:block text-xs font-mono text-slate-600 max-w-[72px] truncate"
              title={file.siaObjectId}
            >
              {file.siaObjectId.slice(0, 10)}…
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </motion.div>
      </button>

      {/* Accordion body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-navy-700/40 px-4 pt-4 pb-4 grid sm:grid-cols-2 gap-6">
              {/* Pipeline steps */}
              <div>
                <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
                  Pipeline
                </p>
                {PIPELINE_STEPS.map((step, i) => {
                  const state = getStepState(file.status, step.key, i)
                  const ts =
                    state !== 'pending'
                      ? new Date(file.updatedAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : undefined
                  return (
                    <PipelineRow
                      key={step.key}
                      step={step}
                      state={state}
                      progress={step.pct}
                      timestamp={state === 'active' || state === 'done' ? ts : undefined}
                      isLast={i === PIPELINE_STEPS.length - 1}
                    />
                  )
                })}
              </div>

              {/* Metadata */}
              <div>
                <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
                  Metadata
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'File size',   value: formatBytes(file.size) },
                    {
                      label: 'Uploaded',
                      value: new Date(file.createdAt).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }),
                    },
                    { label: 'MIME type',   value: file.mimeType || '—' },
                    { label: 'Sia Object',  value: file.siaObjectId || '—' },
                    { label: 'Indexd CID',  value: file.indexdCid   || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 w-24 shrink-0 pt-0.5">{label}</span>
                      <span
                        className="text-xs font-mono text-slate-300 break-all"
                        title={value}
                      >
                        {value.length > 36 ? value.slice(0, 36) + '…' : value}
                      </span>
                    </div>
                  ))}
                </div>

                {file.status === 'ready' && (
                  <a
                    href={downloadUrl(file.id)}
                    download={file.name}
                    className="mt-5 flex items-center justify-center gap-2 py-2 text-sm rounded-lg bg-aqua-600/15 border border-aqua-600/30 text-aqua-400 hover:bg-aqua-600/25 hover:border-aqua-500/50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download file
                  </a>
                )}

                {file.error && (
                  <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                    <p className="text-xs text-red-400">{file.error}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
