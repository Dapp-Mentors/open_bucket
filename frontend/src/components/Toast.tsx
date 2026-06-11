'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

export interface ToastData {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${
        toast.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : toast.type === 'error'
          ? 'bg-red-500/10 border-red-500/20 text-red-300'
          : 'bg-navy-700 border-navy-600 text-slate-200'
      }`}
    >
      {toast.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
      <p className="text-sm flex-1">{toast.message}</p>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export default function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
