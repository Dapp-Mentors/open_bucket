'use client'
import { useEffect, useRef } from 'react'
import { getFile } from '@/lib/api'
import { upsertLocalFile } from '@/lib/storage'
import type { FileRecord } from '@/types'

/**
 * Polls the backend for a single file's status every `interval` ms
 * until it reaches a terminal state (ready or error), then stops automatically.
 */
export function useFilePoller(
  fileId: string | null,
  onUpdate: (record: FileRecord) => void,
  interval = 1500,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!fileId) return

    const poll = async () => {
      try {
        const record = await getFile(fileId)
        upsertLocalFile(record)
        onUpdate(record)
        // Stop polling once terminal
        if (record.status === 'ready' || record.status === 'error') {
          if (timerRef.current) clearInterval(timerRef.current)
        }
      } catch {
        // Network hiccup — keep polling
      }
    }

    poll()
    timerRef.current = setInterval(poll, interval)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fileId, interval, onUpdate])
}
