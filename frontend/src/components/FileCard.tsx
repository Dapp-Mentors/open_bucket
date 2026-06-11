'use client'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { FileText, Download, Eye, Loader2 } from 'lucide-react'
import type { FileRecord } from '@/types'
import { formatBytes, statusColor, statusLabel } from '@/lib/storage'
import { downloadUrl } from '@/lib/api'

interface FileCardProps {
  file: FileRecord
  onViewDetails: (id: string) => void
}

const STATUS_BAR_COLOR: Record<string, string> = {
  queued:    'bg-slate-500',
  uploading: 'bg-aqua-500',
  pinning:   'bg-violet-500',
  indexing:  'bg-yellow-500',
  ready:     'bg-emerald-500',
  error:     'bg-red-500',
}

export default function FileCard({ file, onViewDetails }: FileCardProps) {
  const isActive = !['ready', 'error'].includes(file.status)
  const barColor = STATUS_BAR_COLOR[file.status] ?? 'bg-slate-500'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col rounded-xl bg-navy-800 border border-navy-700/60 hover:border-navy-600 transition-all shadow-card overflow-hidden"
    >
      {/* Progress bar at top */}
      <div className="h-0.5 w-full bg-navy-700">
        <motion.div
          className={`h-full ${barColor}`}
          initial={false}
          animate={{ width: `${file.progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Icon + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-700 border border-navy-600 shrink-0">
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatBytes(file.size)} · {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {isActive && (
            <Loader2 className="h-3 w-3 text-aqua-400 animate-spin shrink-0" />
          )}
          <span className={`text-xs font-medium ${statusColor(file.status)}`}>
            {statusLabel(file.status)}
          </span>
          {isActive && (
            <span className="text-xs text-slate-500 font-mono">{file.progress}%</span>
          )}
          {file.status === 'ready' && file.siaObjectId && (
            <span className="ml-auto text-xs font-mono text-slate-500 truncate max-w-[80px]" title={file.siaObjectId}>
              {file.siaObjectId.slice(0, 12)}…
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => onViewDetails(file.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500 transition-colors"
          >
            <Eye className="h-3 w-3" />
            Details
          </button>
          {file.status === 'ready' && (
            <a
              href={downloadUrl(file.id)}
              download={file.name}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg bg-aqua-600/15 border border-aqua-600/30 text-aqua-400 hover:bg-aqua-600/25 hover:border-aqua-500/50 transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}
