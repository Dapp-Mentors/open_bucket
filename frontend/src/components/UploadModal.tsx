'use client'
import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { uploadFile } from '@/lib/api'
import { formatBytes } from '@/lib/storage'

interface UploadModalProps {
  open: boolean
  onClose: () => void
  onUploaded: (fileId: string) => void
}

type ModalPhase = 'idle' | 'selected' | 'uploading' | 'queued' | 'error'

export default function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPhase('idle')
    setFile(null)
    setProgress(0)
    setErrMsg('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const pickFile = (f: File) => {
    setFile(f)
    setPhase('selected')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setPhase('uploading')

    // Fake upload progress while the HTTP request goes out
    const fakeInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 85))
    }, 120)

    try {
      const { fileId } = await uploadFile(file)
      clearInterval(fakeInterval)
      setProgress(100)
      setPhase('queued')
      setTimeout(() => {
        handleClose()
        onUploaded(fileId)
      }, 1000)
    } catch (err) {
      clearInterval(fakeInterval)
      setErrMsg(err instanceof Error ? err.message : 'Upload failed')
      setPhase('error')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal panel */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-navy-800 border border-navy-600/50 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-navy-700/60">
                <div>
                  <h2 className="font-semibold text-slate-100">Upload a file</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Pinned to Sia via Inngest pipeline</p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Drop zone */}
                {(phase === 'idle' || phase === 'selected') && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                      dragging
                        ? 'border-aqua-500 bg-aqua-500/5'
                        : 'border-navy-600 hover:border-navy-500 hover:bg-navy-700/30'
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      className="hidden"
                      onChange={onInputChange}
                    />

                    {phase === 'selected' && file ? (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-600/15 border border-aqua-600/30">
                          <FileText className="h-6 w-6 text-aqua-400" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-slate-200 text-sm truncate max-w-[240px]">{file.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)} · {file.type || 'unknown type'}</p>
                        </div>
                        <p className="text-xs text-slate-500">Click to change file</p>
                      </>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-700 border border-navy-600">
                          <Upload className="h-6 w-6 text-slate-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-300 font-medium">Drop a file here</p>
                          <p className="text-xs text-slate-500 mt-0.5">or click to browse · up to 100 MB</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Uploading state */}
                {phase === 'uploading' && (
                  <div className="space-y-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aqua-600/15 border border-aqua-600/30 shrink-0">
                        <FileText className="h-5 w-5 text-aqua-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{file?.name}</p>
                        <p className="text-xs text-slate-400">Sending to backend…</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-navy-700 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-aqua-600 to-aqua-400"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 text-center">{progress}%</p>
                  </div>
                )}

                {/* Queued / success state */}
                {phase === 'queued' && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle className="h-10 w-10 text-emerald-400" />
                    </motion.div>
                    <p className="text-sm font-medium text-slate-200">Pipeline started!</p>
                    <p className="text-xs text-slate-400">Taking you to the activity view…</p>
                  </div>
                )}

                {/* Error state */}
                {phase === 'error' && (
                  <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">Upload failed</p>
                      <p className="text-xs text-red-400/80 mt-0.5">{errMsg}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {(phase === 'idle' || phase === 'selected' || phase === 'error') && (
                  <div className="flex gap-2 pt-1">
                    {phase === 'error' && (
                      <button
                        onClick={reset}
                        className="flex-1 py-2 text-sm rounded-lg border border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500 transition-colors"
                      >
                        Try again
                      </button>
                    )}
                    <button
                      onClick={handleUpload}
                      disabled={!file || phase !== 'selected'}
                      className="flex-1 py-2 text-sm font-medium rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Start upload
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
