'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, CheckCircle, Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import { pollSiaConnection } from '@/lib/api'
import type { SiaStatus } from '@/types'

interface SetupModalProps {
    /** The approval URL returned by the backend on first load */
    approvalUrl: string
    /** Called once the backend confirms the app is connected */
    onConnected: () => void
}

type Phase = 'waiting' | 'polling' | 'success' | 'error'

export default function SetupModal({ approvalUrl, onConnected }: SetupModalProps) {
    const [phase, setPhase] = useState<Phase>('waiting')
    const [copied, setCopied] = useState(false)
    const [errMsg, setErrMsg] = useState('')
    const [dots, setDots] = useState('')
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const mountRef = useRef(true)

    // Animate the "Checking…" dots
    useEffect(() => {
        if (phase === 'polling') {
            dotsRef.current = setInterval(
                () => setDots((d) => (d.length >= 3 ? '' : d + '.')),
                420,
            )
        } else {
            if (dotsRef.current) clearInterval(dotsRef.current)
            setDots('')
        }
        return () => { if (dotsRef.current) clearInterval(dotsRef.current) }
    }, [phase])

    useEffect(() => {
        return () => {
            mountRef.current = false
            if (pollRef.current) clearTimeout(pollRef.current)
            if (dotsRef.current) clearInterval(dotsRef.current)
        }
    }, [])

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(approvalUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // clipboard unavailable — ignore silently
        }
    }

    /**
     * The user clicked "I've approved it".
     * Poll the backend up to 8 times (every 2 s) waiting for register() to succeed.
     */
    const checkApproval = useCallback(async () => {
        setPhase('polling')
        setErrMsg('')

        let attempts = 0
        const MAX = 8

        const attempt = async () => {
            if (!mountRef.current) return

            try {
                const status: SiaStatus = await pollSiaConnection()

                if (status.connected && !status.approvalPending) {
                    setPhase('success')
                    setTimeout(() => {
                        if (mountRef.current) onConnected()
                    }, 1600)
                    return
                }
            } catch {
                // network blip — keep trying
            }

            attempts++
            if (attempts >= MAX) {
                if (mountRef.current) {
                    setPhase('error')
                    setErrMsg(
                        "Couldn't confirm the approval — make sure you clicked Approve in the Sia portal, then try again."
                    )
                }
                return
            }

            pollRef.current = setTimeout(attempt, 2000)
        }

        attempt()
    }, [onConnected])

    return (
        <AnimatePresence>
            {/* Backdrop — not dismissible; setup is required */}
            <motion.div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            />

            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="relative w-full max-w-lg rounded-2xl bg-navy-800 border border-navy-600/50 shadow-2xl overflow-hidden"
                    initial={{ scale: 0.94, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.94, y: 16 }}
                    transition={{ duration: 0.26, ease: 'easeOut' }}
                >
                    {/* Top accent bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-aqua-700 via-aqua-400 to-aqua-700" />

                    <div className="px-8 pt-8 pb-8 space-y-6">

                        {/* ── Header ── */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-3">
                                {/* Sia logo mark — simple hex grid icon */}
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua-600/15 border border-aqua-600/30">
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-aqua-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path d="M12 2L20 6.5V17.5L12 22L4 17.5V6.5L12 2Z" />
                                        <path d="M12 8L16 10.5V15.5L12 18L8 15.5V10.5L12 8Z" />
                                    </svg>
                                </div>
                                <span className="text-xs font-mono text-aqua-500 uppercase tracking-widest">One-time setup</span>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-100 leading-snug">
                                Approve OpenBucket on the Sia network
                            </h2>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Before you can pin files, the app needs a one-time approval from the Sia indexer.
                                This only happens once — after that, it reconnects automatically.
                            </p>
                        </div>

                        {/* ── Step list ── */}
                        <div className="space-y-4">
                            {/* Step 1 */}
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua-600/20 border border-aqua-600/40 text-aqua-400 text-xs font-bold mt-0.5">
                                    1
                                </div>
                                <div className="space-y-2 flex-1">
                                    <p className="text-sm text-slate-200 font-medium">Open the approval link</p>
                                    <div className="flex items-center gap-2 rounded-xl bg-navy-900/70 border border-navy-700 px-3 py-2.5">
                                        <span className="flex-1 text-xs font-mono text-aqua-300 truncate">
                                            {approvalUrl}
                                        </span>
                                        <button
                                            onClick={copyUrl}
                                            title="Copy URL"
                                            className="shrink-0 p-1 rounded-md hover:bg-navy-700 text-slate-400 hover:text-slate-200 transition-colors"
                                        >
                                            {copied
                                                ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                : <Copy className="h-3.5 w-3.5" />
                                            }
                                        </button>
                                        <a
                                            href={approvalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 p-1 rounded-md hover:bg-navy-700 text-slate-400 hover:text-slate-200 transition-colors"
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua-600/20 border border-aqua-600/40 text-aqua-400 text-xs font-bold mt-0.5">
                                    2
                                </div>
                                <div className="pt-0.5">
                                    <p className="text-sm text-slate-200 font-medium">Click <span className="font-semibold text-aqua-300">Approve</span> on that page</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Log in with your Sia account if prompted</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua-600/20 border border-aqua-600/40 text-aqua-400 text-xs font-bold mt-0.5">
                                    3
                                </div>
                                <div className="pt-0.5">
                                    <p className="text-sm text-slate-200 font-medium">Come back here and confirm</p>
                                    <p className="text-xs text-slate-500 mt-0.5">We'll check the connection and let you in</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Status area ── */}
                        <AnimatePresence mode="wait">
                            {phase === 'error' && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3"
                                >
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-300 leading-relaxed">{errMsg}</p>
                                </motion.div>
                            )}

                            {phase === 'success' && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3"
                                >
                                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <p className="text-xs text-emerald-300 font-medium">Connected! Taking you in…</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── CTA ── */}
                        {(phase === 'waiting' || phase === 'error') && (
                            <button
                                onClick={checkApproval}
                                className="w-full py-3 rounded-xl bg-aqua-600 hover:bg-aqua-500 text-white text-sm font-medium transition-all shadow-aqua-glow hover:shadow-none"
                            >
                                I've approved it — check connection
                            </button>
                        )}

                        {phase === 'polling' && (
                            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-navy-700/50 border border-navy-600/50">
                                <Loader2 className="h-4 w-4 text-aqua-400 animate-spin" />
                                <span className="text-sm text-slate-300 font-mono">
                                    Checking{dots}
                                </span>
                            </div>
                        )}

                        {/* Skip to demo link — small and unobtrusive */}
                        {(phase === 'waiting' || phase === 'error') && (
                            <p className="text-center text-xs text-slate-600">
                                Don't have a Sia account?{' '}
                                <button
                                    onClick={onConnected}
                                    className="text-slate-400 hover:text-slate-300 underline underline-offset-2 transition-colors"
                                >
                                    Continue in demo mode
                                </button>
                            </p>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}