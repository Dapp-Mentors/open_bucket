'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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

// ─── Particles ───────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number
  vx: number; vy: number
  r: number; life: number; maxLife: number
}

function mkParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.9,
    vy: (Math.random() - 0.5) * 0.5,
    r: Math.random() * 2 + 0.5,
    life: Math.random(),
    maxLife: Math.random() * 0.5 + 0.5,
  }
}

function ParticleCanvas({ running }: { running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)
  const particles = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !running) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height

    particles.current = Array.from({ length: 36 }, () => mkParticle(W, H))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      particles.current.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.life += 0.008
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life > p.maxLife) {
          Object.assign(p, mkParticle(W, H))
          p.life = 0
        }
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.75
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#16a298'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })

      // Connectors
      const ps = particles.current
      ctx.strokeStyle = '#16a298'
      ctx.lineWidth = 0.4
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x
          const dy = ps[i].y - ps[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < 70) {
            ctx.globalAlpha = (1 - d / 70) * 0.18
            ctx.beginPath()
            ctx.moveTo(ps[i].x, ps[i].y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running])

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={72}
      className="w-full rounded-xl bg-aqua-600/5 border border-aqua-600/10"
    />
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [phase,    setPhase]    = useState<ModalPhase>('idle')
  const [file,     setFile]     = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [errMsg,   setErrMsg]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fakeRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const reset = () => {
    setPhase('idle'); setFile(null); setProgress(0); setErrMsg('')
    if (fakeRef.current) { clearInterval(fakeRef.current); fakeRef.current = null }
  }

  const handleClose = () => { reset(); onClose() }

  // Reset state whenever modal re-opens
  useEffect(() => { if (open) reset() }, [open])

  const pickFile = (f: File) => { setFile(f); setPhase('selected') }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setPhase('uploading')
    setProgress(0)

    fakeRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 7 + 2, 88))
    }, 140)

    try {
      const { fileId } = await uploadFile(file)
      if (fakeRef.current) { clearInterval(fakeRef.current); fakeRef.current = null }
      setProgress(100)
      setPhase('queued')
      setTimeout(() => { handleClose(); onUploaded(fileId) }, 1100)
    } catch (err) {
      if (fakeRef.current) { clearInterval(fakeRef.current); fakeRef.current = null }
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
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-md rounded-2xl bg-navy-800 border border-navy-600/50 shadow-2xl pointer-events-auto"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
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
        {/* ── Idle/Selected ── */}
                {(phase === 'idle' || phase === 'selected') && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                      dragging
                        ? 'border-aqua-500 bg-aqua-500/5'
                        : phase === 'selected'
                        ? 'border-aqua-600/50 bg-aqua-600/5'
                        : 'border-navy-600 hover:border-navy-500 hover:bg-navy-700/30'
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
                    />

                    {phase === 'selected' && file ? (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-600/15 border border-aqua-600/30">
                          <FileText className="h-6 w-6 text-aqua-400" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-slate-200 text-sm truncate max-w-[240px]">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatBytes(file.size)} · {file.type || 'unknown type'}
                          </p>
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
                          <p className="text-xs text-slate-500 mt-0.5">
                            or click to browse · up to 100 MB
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Uploading ── */}
                {phase === 'uploading' && (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aqua-600/15 border border-aqua-600/30 shrink-0">
                        <FileText className="h-5 w-5 text-aqua-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{file?.name}</p>
                        <p className="text-xs text-slate-400">Sending to backend…</p>
                      </div>
                    </div>

                    {/* Particles */}
                    <ParticleCanvas running={phase === 'uploading'} />

                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-navy-700 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-aqua-700 to-aqua-400"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 text-center font-mono">
                      {Math.round(progress)}%
                    </p>
                  </div>
                )}

                {/* ── Queued ── */}
                {phase === 'queued' && (
                  <div className="flex flex-col items-center gap-2 py-5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    >
                      <CheckCircle className="h-12 w-12 text-emerald-400" />
                    </motion.div>
                    <p className="text-sm font-medium text-slate-200">Pipeline started!</p>
                    <p className="text-xs text-slate-400">Watch the progress on the card below…</p>
                  </div>
                )}

                {/* ── Error ── */}
                {phase === 'error' && (
                  <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">Upload failed</p>
                      <p className="text-xs text-red-400/80 mt-0.5">{errMsg}</p>
                    </div>
                  </div>
                )}

                {/* ── Actions ── */}
                {(phase === 'idle' || phase === 'selected' || phase === 'error') && (
                  <div className="flex gap-2 pt-1">
                    {phase === 'error' ? (
                      <button
                        onClick={reset}
                        className="flex-1 py-2 text-sm rounded-lg border border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500 transition-colors"
                      >
                        Try again
                      </button>
                    ) : (
                      <button
                        onClick={handleClose}
                        className="flex-1 py-2 text-sm rounded-lg border border-navy-600 text-slate-400 hover:text-slate-200 hover:border-navy-500 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleUpload}
                      disabled={phase !== 'selected'}
                      className="flex-1 py-2 text-sm font-medium rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Start upload
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
