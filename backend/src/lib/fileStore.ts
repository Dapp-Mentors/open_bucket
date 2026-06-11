/**
 * SQLite-backed file store with optional local file storage for demo mode.
 * In live mode, files are uploaded to Sia and the local copy is cleaned up.
 * In demo mode, files are kept at a persistent path so downloads still work.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

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
  /** Path to the local file copy (used by demo mode for downloads) */
  dataPath?: string
}

const DB_PATH = process.env.FILE_DB_PATH ?? '/app/data/files.db'

/** Coerce undefined values to null for SQLite compatibility */
function toRow(record: FileRecord) {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    size: record.size,
    status: record.status,
    progress: record.progress,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    siaObjectId: record.siaObjectId ?? null,
    pinnedAt: record.pinnedAt ?? null,
    indexdCid: record.indexdCid ?? null,
    error: record.error ?? null,
    dataPath: record.dataPath ?? null,
  }
}

class FileStore {
  private db: Database.Database

  constructor() {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

    this.db = new Database(DB_PATH)

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')

    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        mimeType   TEXT NOT NULL DEFAULT '',
        size       INTEGER NOT NULL DEFAULT 0,
        status     TEXT NOT NULL DEFAULT 'queued',
        progress   INTEGER NOT NULL DEFAULT 0,
        createdAt  TEXT NOT NULL,
        updatedAt  TEXT NOT NULL,
        siaObjectId TEXT,
        pinnedAt   TEXT,
        indexdCid  TEXT,
        error      TEXT,
        dataPath   TEXT
      )
    `)

    // Migrate: add dataPath column if it doesn't exist (for existing DBs)
    try {
      this.db.exec('ALTER TABLE files ADD COLUMN dataPath TEXT')
    } catch {
      // Column already exists — fine
    }

    console.log('[FileStore] SQLite database ready at', DB_PATH)
  }

  add(record: FileRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO files (id, name, mimeType, size, status, progress, createdAt, updatedAt,
                         siaObjectId, pinnedAt, indexdCid, error, dataPath)
      VALUES (@id, @name, @mimeType, @size, @status, @progress, @createdAt, @updatedAt,
              @siaObjectId, @pinnedAt, @indexdCid, @error, @dataPath)
    `)
    stmt.run(toRow(record))
  }

  get(id: string): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?')
    const row = stmt.get(id) as Record<string, unknown> | undefined
    if (!row) return undefined
    return nullToUndefined(row) as unknown as FileRecord
  }

  getAll(): FileRecord[] {
    const stmt = this.db.prepare('SELECT * FROM files ORDER BY createdAt DESC')
    const rows = stmt.all() as Record<string, unknown>[]
    return rows.map((r) => nullToUndefined(r)) as unknown as FileRecord[]
  }

  updateStatus(
    id: string,
    status: FileStatus,
    progress: number,
    extra?: Partial<FileRecord>
  ) {
    const rec = this.get(id)
    if (!rec) return
    const updated = {
      ...rec,
      ...extra,
      status,
      progress,
      updatedAt: new Date().toISOString(),
    }
    const stmt = this.db.prepare(`
      UPDATE files SET
        name = @name, mimeType = @mimeType, size = @size,
        status = @status, progress = @progress,
        createdAt = @createdAt, updatedAt = @updatedAt,
        siaObjectId = @siaObjectId, pinnedAt = @pinnedAt,
        indexdCid = @indexdCid, error = @error,
        dataPath = @dataPath
      WHERE id = @id
    `)
    stmt.run(toRow(updated))
  }

  setError(id: string, error: string) {
    const rec = this.get(id)
    if (!rec) return
    const stmt = this.db.prepare(`
      UPDATE files SET status = 'error', error = ?, updatedAt = ? WHERE id = ?
    `)
    stmt.run(error, new Date().toISOString(), id)
  }

  delete(id: string): boolean {
    // Delete the local file if it exists
    const rec = this.get(id)
    if (rec?.dataPath) {
      try {
        fs.unlinkSync(rec.dataPath)
      } catch {
        // already gone, fine
      }
    }
    const stmt = this.db.prepare('DELETE FROM files WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }

  close() {
    this.db.close()
  }
}

/** Convert SQLite null values back to undefined for JS consumers */
function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === null ? undefined : value
  }
  return out
}

export const fileStore = new FileStore()