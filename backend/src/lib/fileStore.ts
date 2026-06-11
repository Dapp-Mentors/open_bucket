/**
 * Simple in-memory store.
 * In a real deployment you'd use Redis or Postgres.
 * For this demo container, in-memory + localStorage on the client is fine.
 */

export type FileStatus = 'queued' | 'uploading' | 'pinning' | 'indexing' | 'ready' | 'error'

export interface FileRecord {
  id: string
  name: string
  mimeType: string
  size: number
  status: FileStatus
  progress: number
  createdAt: string
  updatedAt: string
  siaObjectId?: string
  pinnedAt?: string
  indexdCid?: string
  error?: string
}

class FileStore {
  private records = new Map<string, FileRecord>()

  add(record: FileRecord) {
    this.records.set(record.id, record)
  }

  get(id: string): FileRecord | undefined {
    return this.records.get(id)
  }

  getAll(): FileRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  updateStatus(
    id: string,
    status: FileStatus,
    progress: number,
    extra?: Partial<FileRecord>
  ) {
    const rec = this.records.get(id)
    if (!rec) return
    Object.assign(rec, { status, progress, updatedAt: new Date().toISOString(), ...extra })
  }

  setError(id: string, error: string) {
    const rec = this.records.get(id)
    if (!rec) return
    Object.assign(rec, { status: 'error' as FileStatus, error, updatedAt: new Date().toISOString() })
  }
}

export const fileStore = new FileStore()
