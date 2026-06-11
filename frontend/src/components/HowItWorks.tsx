'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    title: 'You drop a file',
    body: 'The frontend sends it to the Express backend via multipart form upload. Multer writes it to a temp directory.',
  },
  {
    n: '02',
    title: 'Inngest kicks off the pipeline',
    body: 'The backend fires a file/upload.requested event. Inngest picks it up and runs three durable steps — no single long HTTP request, no lost progress on restart.',
  },
  {
    n: '03',
    title: 'Sia encrypts and distributes the data',
    body: 'The Sia SDK uploads your file, erasure-codes it into redundant shards, and spreads them across independent storage providers worldwide.',
  },
  {
    n: '04',
    title: 'The indexer pins the object',
    body: 'Pinning tells the indexer to keep track of your object, making it listable, retrievable, and eligible for automatic repair if any shards go missing.',
  },
  {
    n: '05',
    title: 'Indexd registers metadata',
    body: 'A simulated Indexd call creates a DID-based content identifier linking your file to the Sia object.',
  },
]

export default function HowItWorks() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-navy-700/60 bg-navy-800/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-navy-700/30 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">How it works</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-navy-700/40 pt-4">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <span className="text-xs font-mono text-aqua-500 mt-0.5 shrink-0 w-5">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
