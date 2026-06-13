/** Tests for FileStore helpers and CRUD logic using in-memory sql.js. */

import initSqlJs, { Database } from 'sql.js'

// ---- Types (mirrored from fileStore.ts to avoid the real DB singleton) ----

type FileStatus = 'queued' | 'uploading' | 'pinning' | 'indexing' | 'ready' | 'error'

interface FileRecord {
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
  dataPath?: string
}

// ---- Pure helpers (must stay in sync with backend/src/lib/fileStore.ts) ----

function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === null ? undefined : value
  }
  return out
}

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

// ---- sql.js helpers ----

function rowsToObjects(result: ReturnType<Database['exec']>): Record<string, unknown>[] {
  if (!result.length) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function createTestStore(db: Database) {
  db.run(`
    CREATE TABLE files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mimeType TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      siaObjectId TEXT,
      pinnedAt TEXT,
      indexdCid TEXT,
      error TEXT,
      dataPath TEXT
    )
  `)

  return {
    add(record: FileRecord) {
      const r = toRow(record)
      db.run(
        `INSERT INTO files VALUES (:id,:name,:mimeType,:size,:status,:progress,:createdAt,:updatedAt,:siaObjectId,:pinnedAt,:indexdCid,:error,:dataPath)`,
        { ':id': r.id, ':name': r.name, ':mimeType': r.mimeType, ':size': r.size,
          ':status': r.status, ':progress': r.progress, ':createdAt': r.createdAt,
          ':updatedAt': r.updatedAt, ':siaObjectId': r.siaObjectId,
          ':pinnedAt': r.pinnedAt, ':indexdCid': r.indexdCid,
          ':error': r.error, ':dataPath': r.dataPath }
      )
    },
    get(id: string): FileRecord | undefined {
      const res = db.exec('SELECT * FROM files WHERE id=?', [id])
      const rows = rowsToObjects(res)
      if (!rows.length) return undefined
      return nullToUndefined(rows[0]) as unknown as FileRecord
    },
    getAll(): FileRecord[] {
      const res = db.exec('SELECT * FROM files ORDER BY createdAt DESC')
      return rowsToObjects(res).map(r => nullToUndefined(r)) as unknown as FileRecord[]
    },
    updateStatus(id: string, status: FileStatus, progress: number, extra?: Partial<FileRecord>) {
      const rec = this.get(id)
      if (!rec) return
      const updated = { ...rec, ...extra, status, progress, updatedAt: new Date().toISOString() }
      const r = toRow(updated)
      db.run(
        `UPDATE files SET name=:name,mimeType=:mimeType,size=:size,status=:status,progress=:progress,
         createdAt=:createdAt,updatedAt=:updatedAt,siaObjectId=:siaObjectId,pinnedAt=:pinnedAt,
         indexdCid=:indexdCid,error=:error,dataPath=:dataPath WHERE id=:id`,
        { ':id': r.id, ':name': r.name, ':mimeType': r.mimeType, ':size': r.size,
          ':status': r.status, ':progress': r.progress, ':createdAt': r.createdAt,
          ':updatedAt': r.updatedAt, ':siaObjectId': r.siaObjectId,
          ':pinnedAt': r.pinnedAt, ':indexdCid': r.indexdCid,
          ':error': r.error, ':dataPath': r.dataPath }
      )
    },
    setError(id: string, error: string) {
      db.run('UPDATE files SET status=?,error=?,updatedAt=? WHERE id=?',
        ['error', error, new Date().toISOString(), id])
    },
    delete(id: string): boolean {
      db.run('DELETE FROM files WHERE id=?', [id])
      const res = db.exec('SELECT changes() as c')
      return (res[0]?.values[0][0] as number) > 0
    },
  }
}

const makeBase = (): FileRecord => ({
  id: 'test-1',
  name: 'hello.txt',
  mimeType: 'text/plain',
  size: 42,
  status: 'queued',
  progress: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
})

// ---- Pure helper tests ----

describe('nullToUndefined', () => {
  it('converts null values to undefined', () => {
    const result = nullToUndefined({ a: null, b: 'hello', c: 0 })
    expect(result.a).toBeUndefined()
    expect(result.b).toBe('hello')
    expect(result.c).toBe(0)
  })

  it('leaves non-null values unchanged', () => {
    expect(nullToUndefined({ x: 'val', y: 123 })).toEqual({ x: 'val', y: 123 })
  })

  it('handles an empty object', () => {
    expect(nullToUndefined({})).toEqual({})
  })
})

describe('toRow', () => {
  it('maps undefined optional fields to null', () => {
    const row = toRow(makeBase())
    expect(row.siaObjectId).toBeNull()
    expect(row.pinnedAt).toBeNull()
    expect(row.indexdCid).toBeNull()
    expect(row.error).toBeNull()
    expect(row.dataPath).toBeNull()
  })

  it('preserves optional fields when present', () => {
    const row = toRow({ ...makeBase(), siaObjectId: 'sia-123', error: 'oops' })
    expect(row.siaObjectId).toBe('sia-123')
    expect(row.error).toBe('oops')
  })

  it('copies all required fields verbatim', () => {
    const base = makeBase()
    const row = toRow(base)
    expect(row.id).toBe(base.id)
    expect(row.name).toBe(base.name)
    expect(row.size).toBe(base.size)
    expect(row.status).toBe(base.status)
    expect(row.progress).toBe(base.progress)
  })
})

// ---- CRUD tests (in-memory sql.js) ----

describe('FileStore (in-memory)', () => {
  let freshStore: ReturnType<typeof createTestStore>

  beforeEach(async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    freshStore = createTestStore(db)
  })

  it('adds and retrieves a file', () => {
    freshStore.add(makeBase())
    const rec = freshStore.get('test-1')
    expect(rec).toBeDefined()
    expect(rec!.name).toBe('hello.txt')
    expect(rec!.status).toBe('queued')
  })

  it('returns undefined for missing id', () => {
    expect(freshStore.get('nope')).toBeUndefined()
  })

  it('getAll returns records newest-first', () => {
    freshStore.add({ ...makeBase(), id: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' })
    freshStore.add({ ...makeBase(), id: 'b', createdAt: '2025-01-02T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' })
    const all = freshStore.getAll()
    expect(all[0].id).toBe('b')
    expect(all[1].id).toBe('a')
  })

  it('getAll returns empty array when no records', () => {
    expect(freshStore.getAll()).toEqual([])
  })

  it('updateStatus changes status and progress', () => {
    freshStore.add(makeBase())
    freshStore.updateStatus('test-1', 'uploading', 40)
    const rec = freshStore.get('test-1')
    expect(rec!.status).toBe('uploading')
    expect(rec!.progress).toBe(40)
  })

  it('updateStatus can attach extra fields', () => {
    freshStore.add(makeBase())
    freshStore.updateStatus('test-1', 'pinning', 75, { siaObjectId: 'sia-xyz' })
    expect(freshStore.get('test-1')!.siaObjectId).toBe('sia-xyz')
  })

  it('updateStatus does nothing for unknown id', () => {
    freshStore.updateStatus('ghost', 'ready', 100)
    expect(freshStore.get('ghost')).toBeUndefined()
  })

  it('setError sets status to error with message', () => {
    freshStore.add(makeBase())
    freshStore.setError('test-1', 'something broke')
    const rec = freshStore.get('test-1')
    expect(rec!.status).toBe('error')
    expect(rec!.error).toBe('something broke')
  })

  it('delete removes the record and returns true', () => {
    freshStore.add(makeBase())
    expect(freshStore.delete('test-1')).toBe(true)
    expect(freshStore.get('test-1')).toBeUndefined()
  })

  it('delete returns false for non-existent id', () => {
    expect(freshStore.delete('ghost')).toBe(false)
  })

  it('optional fields round-trip correctly through null/undefined conversion', () => {
    freshStore.add({ ...makeBase(), indexdCid: 'cid-abc' })
    const rec = freshStore.get('test-1')
    expect(rec!.indexdCid).toBe('cid-abc')
    expect(rec!.pinnedAt).toBeUndefined()
  })
})