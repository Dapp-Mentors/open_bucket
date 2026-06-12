import type { FileRecord, SiaStatus } from '@/types'

// All API calls go through Next.js proxy routes (/api/...) so the browser
// always makes same-origin requests. The proxy routes use BACKEND_URL
// (a server-side env var set to the Docker service name, e.g.
// http://backend:4000) to reach the backend container. This eliminates
// all cross-container fetch failures in Docker and removes the need for
// NEXT_PUBLIC_BACKEND_URL entirely.

// ── File API ────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<{ fileId: string; status: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getFile(id: string): Promise<FileRecord> {
  const res = await fetch(`/api/files/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listFiles(): Promise<FileRecord[]> {
  const res = await fetch('/api/files')
  if (!res.ok) return []
  return res.json()
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export function downloadUrl(id: string): string {
  return `/api/files/${id}/download`
}

// ── Sia status API ──────────────────────────────────────────────────────────

export async function getSiaStatus(): Promise<SiaStatus> {
  try {
    const res = await fetch('/api/sia/status', { cache: 'no-store' })
    if (!res.ok) return { connected: false, mode: 'demo', indexer: 'unknown' }
    return res.json()
  } catch {
    return { connected: false, mode: 'demo', indexer: 'unknown' }
  }
}

/**
 * Called after the user approves the app in the Sia portal.
 * Triggers the backend to attempt register() and returns the updated status.
 */
export async function pollSiaConnection(): Promise<SiaStatus> {
  try {
    const res = await fetch('/api/sia/poll-connection', { method: 'POST' })
    if (!res.ok) return { connected: false, mode: 'demo', indexer: 'unknown' }
    return res.json()
  } catch {
    return { connected: false, mode: 'demo', indexer: 'unknown' }
  }
}