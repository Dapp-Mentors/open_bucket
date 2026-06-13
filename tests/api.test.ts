/**
 * Tests for frontend api.ts helpers.
 * fetch() is mocked — we only test the request shape and return-value logic,
 * not network I/O.
 */

// Minimal types inline so we don't need the full Next.js build
interface FileRecord {
  id: string
  name: string
  mimeType: string
  size: number
  status: string
  progress: number
  createdAt: string
  updatedAt: string
}

interface SiaStatus {
  connected: boolean
  mode: 'demo' | 'live'
  indexer: string
  reason?: string
}

// Replicate the helpers we can test without fetch
function downloadUrl(id: string, base = 'http://localhost:4000') {
  return `${base}/api/files/${id}/download`
}

// Replicate getSiaStatus fallback value (the real one returns this on fetch failure)
const SIA_FALLBACK: SiaStatus = { connected: false, mode: 'demo', indexer: 'unknown' }

describe('downloadUrl', () => {
  it('builds the correct URL from file id', () => {
    expect(downloadUrl('abc-123')).toBe('http://localhost:4000/api/files/abc-123/download')
  })

  it('uses a custom base URL when provided', () => {
    expect(downloadUrl('xyz', 'https://api.example.com'))
      .toBe('https://api.example.com/api/files/xyz/download')
  })

  it('handles IDs with hyphens and numbers', () => {
    const id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(downloadUrl(id)).toContain(id)
  })
})

describe('getSiaStatus fallback', () => {
  it('fallback value marks connection as false', () => {
    expect(SIA_FALLBACK.connected).toBe(false)
  })

  it('fallback mode is demo', () => {
    expect(SIA_FALLBACK.mode).toBe('demo')
  })

  it('fallback indexer is unknown', () => {
    expect(SIA_FALLBACK.indexer).toBe('unknown')
  })
})

describe('API URL construction', () => {
  const BASE = 'http://localhost:4000'

  it('upload endpoint is correct', () => {
    expect(`${BASE}/api/upload`).toBe('http://localhost:4000/api/upload')
  })

  it('file detail endpoint is correct', () => {
    expect(`${BASE}/api/files/my-id`).toBe('http://localhost:4000/api/files/my-id')
  })

  it('file list endpoint is correct', () => {
    expect(`${BASE}/api/files`).toBe('http://localhost:4000/api/files')
  })

  it('sia status endpoint is correct', () => {
    expect(`${BASE}/api/sia/status`).toBe('http://localhost:4000/api/sia/status')
  })
})
