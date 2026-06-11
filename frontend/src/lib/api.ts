import type { FileRecord, SiaStatus } from '@/types'

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'

export async function uploadFile(file: File): Promise<{ fileId: string; status: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getFile(id: string): Promise<FileRecord> {
  const res = await fetch(`${BASE}/api/files/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listFiles(): Promise<FileRecord[]> {
  const res = await fetch(`${BASE}/api/files`)
  if (!res.ok) return []
  return res.json()
}

export async function getSiaStatus(): Promise<SiaStatus> {
  const res = await fetch(`${BASE}/api/sia/status`)
  if (!res.ok) return { connected: false, mode: 'demo', indexer: 'unknown' }
  return res.json()
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/files/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export function downloadUrl(id: string) {
  return `${BASE}/api/files/${id}/download`
}
