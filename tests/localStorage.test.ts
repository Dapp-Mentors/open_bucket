import { loadLocalFiles, saveLocalFiles, upsertLocalFile } from '../frontend/src/lib/storage'
import type { FileRecord } from '../frontend/src/types'

// Minimal localStorage mock
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
Object.defineProperty(global, 'window', { value: { localStorage: localStorageMock } })

const makeFile = (id: string, name = 'file.txt'): FileRecord => ({
  id,
  name,
  mimeType: 'text/plain',
  size: 100,
  status: 'ready',
  progress: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

beforeEach(() => {
  localStorageMock.clear()
})

describe('loadLocalFiles', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadLocalFiles()).toEqual([])
  })

  it('returns empty array on malformed JSON', () => {
    store['openbucket:files'] = 'not json {'
    expect(loadLocalFiles()).toEqual([])
  })

  it('returns parsed files', () => {
    const files = [makeFile('a'), makeFile('b')]
    store['openbucket:files'] = JSON.stringify(files)
    expect(loadLocalFiles()).toHaveLength(2)
    expect(loadLocalFiles()[0].id).toBe('a')
  })
})

describe('saveLocalFiles', () => {
  it('persists files to localStorage', () => {
    const files = [makeFile('x')]
    saveLocalFiles(files)
    expect(JSON.parse(store['openbucket:files'])[0].id).toBe('x')
  })

  it('overwrites previous data', () => {
    saveLocalFiles([makeFile('first')])
    saveLocalFiles([makeFile('second')])
    const saved = JSON.parse(store['openbucket:files'])
    expect(saved).toHaveLength(1)
    expect(saved[0].id).toBe('second')
  })
})

describe('upsertLocalFile', () => {
  it('prepends a new file', () => {
    saveLocalFiles([makeFile('existing')])
    upsertLocalFile(makeFile('new'))
    const files = loadLocalFiles()
    expect(files[0].id).toBe('new')
    expect(files[1].id).toBe('existing')
  })

  it('updates an existing file in place', () => {
    const original = makeFile('abc')
    saveLocalFiles([original])

    const updated = { ...original, name: 'updated.txt', status: 'error' as const }
    upsertLocalFile(updated)

    const files = loadLocalFiles()
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('updated.txt')
    expect(files[0].status).toBe('error')
  })

  it('preserves order when updating a middle file', () => {
    saveLocalFiles([makeFile('a'), makeFile('b'), makeFile('c')])
    upsertLocalFile({ ...makeFile('b'), name: 'changed.txt' })
    const files = loadLocalFiles()
    expect(files.map(f => f.id)).toEqual(['a', 'b', 'c'])
    expect(files[1].name).toBe('changed.txt')
  })
})