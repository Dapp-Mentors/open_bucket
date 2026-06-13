'use client'
import { useEffect, useRef } from 'react'
import { getFile } from '@/lib/api'
import type { FileRecord } from '@/types'

/** Poll backend until file status is terminal (ready/error). */
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
        onUpdate(record)
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
