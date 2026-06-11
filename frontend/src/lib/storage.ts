import type { FileRecord } from '@/types'

const KEY = 'openbucket:files'

export function loadLocalFiles(): FileRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as FileRecord[]
  } catch {
    return []
  }
}

export function saveLocalFiles(files: FileRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(files))
}

export function upsertLocalFile(file: FileRecord) {
  const all = loadLocalFiles()
  const idx = all.findIndex((f) => f.id === file.id)
  if (idx >= 0) {
    all[idx] = file
  } else {
    all.unshift(file)
  }
  saveLocalFiles(all)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ready':     return 'text-emerald-400'
    case 'error':     return 'text-red-400'
    case 'uploading': return 'text-aqua-400'
    case 'pinning':   return 'text-violet-400'
    case 'indexing':  return 'text-yellow-400'
    default:          return 'text-slate-400'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'queued':    return 'Queued'
    case 'uploading': return 'Uploading'
    case 'pinning':   return 'Pinning'
    case 'indexing':  return 'Indexing'
    case 'ready':     return 'Ready'
    case 'error':     return 'Error'
    default:          return status
  }
}
