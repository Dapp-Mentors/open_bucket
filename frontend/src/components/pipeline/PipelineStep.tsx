'use client'
import { motion } from 'framer-motion'
import { Check, Clock, AlertCircle } from 'lucide-react'

export type StepState = 'pending' | 'active' | 'done' | 'error'

interface PipelineStepProps {
  label: string
  desc: string
  state: StepState
  progress?: number
  timestamp?: string
  isLast?: boolean
}

const DOT_CLASS: Record<StepState, string> = {
  pending: 'bg-navy-700 border-navy-600',
  active:  'bg-navy-800 border-aqua-500',
  done:    'bg-emerald-500/15 border-emerald-500/50',
  error:   'bg-red-500/15 border-red-500/50',
}

const LABEL_CLASS: Record<StepState, string> = {
  pending: 'text-slate-500',
  active:  'text-aqua-300',
  done:    'text-slate-200',
  error:   'text-red-300',
}

export default function PipelineStep({
  label, desc, state, progress, timestamp, isLast,
}: PipelineStepProps) {
  return (
    <div className="flex gap-4">
      {/* Left: dot + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ${DOT_CLASS[state]}`}
        >
          {state === 'done'    && <Check       className="h-3.5 w-3.5 text-emerald-400" />}
          {/* NOTE: 'active' uses a pulse dot, NOT a spinner — avoids infinite loop on ready */}
          {state === 'active'  && <span className="h-2 w-2 rounded-full bg-aqua-400 animate-pulse" />}
          {state === 'pending' && <Clock       className="h-3.5 w-3.5 text-slate-600"   />}
          {state === 'error'   && <AlertCircle className="h-3.5 w-3.5 text-red-400"     />}
        </div>

        {!isLast && (
          <div className="w-px flex-1 mt-1 min-h-[28px] bg-navy-600 overflow-hidden">
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

      {/* Right: content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-medium transition-colors ${LABEL_CLASS[state]}`}>
            {label}
          </span>
          {timestamp && (
            <span className="text-xs text-slate-500 font-mono">{timestamp}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-2">{desc}</p>

        {state === 'active' && typeof progress === 'number' && (
          <div className="h-1 w-full rounded-full bg-navy-700 overflow-hidden">
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
            className="h-1 w-full rounded-full bg-emerald-500/30"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </div>
    </div>
  )
}
