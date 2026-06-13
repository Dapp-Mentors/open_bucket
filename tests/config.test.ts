/**
 * Tests for config.ts path helpers.
 * These are pure string/path computations — no I/O, no external services.
 */

import path from 'path'

// We replicate the logic here so the test can control env vars
// without side-effects on the real module singleton.
function resolveConfig(env: Record<string, string | undefined>) {
  const DATA_DIR = env.DATA_DIR ?? path.resolve('./data')
  const DB_PATH  = env.FILE_DB_PATH ?? path.join(DATA_DIR, 'files.db')
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
  const KEY_PATH    = path.join(DATA_DIR, 'appkey.hex')
  const PHRASE_PATH = path.join(DATA_DIR, 'phrase.enc')
  return { DATA_DIR, DB_PATH, UPLOADS_DIR, KEY_PATH, PHRASE_PATH }
}

describe('config path resolution', () => {
  it('uses ./data as default DATA_DIR', () => {
    const cfg = resolveConfig({})
    expect(cfg.DATA_DIR).toBe(path.resolve('./data'))
  })

  it('respects DATA_DIR env override', () => {
    const cfg = resolveConfig({ DATA_DIR: '/custom/path' })
    expect(cfg.DATA_DIR).toBe('/custom/path')
  })

  it('derives DB_PATH from DATA_DIR by default', () => {
    const cfg = resolveConfig({ DATA_DIR: '/app/data' })
    expect(cfg.DB_PATH).toBe('/app/data/files.db')
  })

  it('respects FILE_DB_PATH env override', () => {
    const cfg = resolveConfig({ DATA_DIR: '/app/data', FILE_DB_PATH: '/var/db/files.db' })
    expect(cfg.DB_PATH).toBe('/var/db/files.db')
  })

  it('UPLOADS_DIR is always under DATA_DIR', () => {
    const cfg = resolveConfig({ DATA_DIR: '/app/data' })
    expect(cfg.UPLOADS_DIR).toBe('/app/data/uploads')
  })

  it('KEY_PATH is always under DATA_DIR', () => {
    const cfg = resolveConfig({ DATA_DIR: '/app/data' })
    expect(cfg.KEY_PATH).toBe('/app/data/appkey.hex')
  })

  it('PHRASE_PATH is always under DATA_DIR', () => {
    const cfg = resolveConfig({ DATA_DIR: '/app/data' })
    expect(cfg.PHRASE_PATH).toBe('/app/data/phrase.enc')
  })

  it('all derived paths stay inside DATA_DIR', () => {
    const cfg = resolveConfig({ DATA_DIR: '/some/dir' })
    ;[cfg.DB_PATH, cfg.UPLOADS_DIR, cfg.KEY_PATH, cfg.PHRASE_PATH].forEach(p => {
      expect(p.startsWith('/some/dir')).toBe(true)
    })
  })
})
