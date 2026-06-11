'use client'
import { motion } from 'framer-motion'
import { Check, Loader2, Clock, AlertCircle } from 'lucide-react'

type StepState = 'pending' | 'active' | 'done' | 'error'

interface PipelineStepProps {
  label: string
  desc: string
  state: StepState
  progress?: number
  timestamp?: string
  isLast?: boolean
}

const ICON_MAP: Record<StepState, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-slate-500" />,
  active:  <Loader2 className="h-3.5 w-3.5 text-aqua-400 animate-spin" />,
  done:    <Check className="h-3.5 w-3.5 text-emerald-400" />,
  error:   <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
}

const DOT_CLASS: Record<StepState, string> = {
  pending: 'bg-navy-700 border-navy-600',
  active:  'bg-navy-800 border-aqua-500 step-active',
  done:    'bg-emerald-500/15 border-emerald-500/50',
  error:   'bg-red-500/15 border-red-500/50',
}

export default function PipelineStep({
  label, desc, state, progress, timestamp, isLast,
}: PipelineStepProps) {
  return (
    <div className="flex gap-4">
      {/* Left: dot + connector line */}
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 shrink-0 ${DOT_CLASS[state]}`}>
          {ICON_MAP[state]}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1 min-h-[28px]">
            <motion.div
              className="w-full h-full bg-navy-600"
              initial={{ scaleY: 0, originY: 0 }}
              animate={{ scaleY: state === 'done' ? 1 : 0.3 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            />
            {state === 'done' && (
              <motion.div
                className="w-full bg-emerald-500/30"
                initial={{ height: 0 }}
                animate={{ height: '100%' }}
                transition={{ duration: 0.5 }}
              />
            )}
          </div>
        )}
      </div>

      {/* Right: content */}
      <div className={`pb-6 flex-1 min-w-0 ${isLast ? '' : ''}`}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-medium transition-colors ${
            state === 'done' ? 'text-slate-200'
            : state === 'active' ? 'text-aqua-300'
            : state === 'error' ? 'text-red-300'
            : 'text-slate-500'
          }`}>
            {label}
          </span>
          {timestamp && (
            <span className="text-xs text-slate-500 font-mono">{timestamp}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-2">{desc}</p>

        {/* Progress bar */}
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
