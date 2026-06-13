import { formatBytes, statusColor, statusLabel } from '../frontend/src/lib/storage'

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('rounds to one decimal place', () => {
    expect(formatBytes(1500)).toBe('1.5 KB')
  })
})

describe('statusColor', () => {
  it('returns emerald for ready', () => {
    expect(statusColor('ready')).toBe('text-emerald-400')
  })

  it('returns red for error', () => {
    expect(statusColor('error')).toBe('text-red-400')
  })

  it('returns aqua for uploading', () => {
    expect(statusColor('uploading')).toBe('text-aqua-400')
  })

  it('returns violet for pinning', () => {
    expect(statusColor('pinning')).toBe('text-violet-400')
  })

  it('returns yellow for indexing', () => {
    expect(statusColor('indexing')).toBe('text-yellow-400')
  })

  it('returns slate for unknown status', () => {
    expect(statusColor('unknown')).toBe('text-slate-400')
    expect(statusColor('')).toBe('text-slate-400')
  })
})

describe('statusLabel', () => {
  const cases: [string, string][] = [
    ['queued',    'Queued'],
    ['uploading', 'Uploading'],
    ['pinning',   'Pinning'],
    ['indexing',  'Indexing'],
    ['ready',     'Ready'],
    ['error',     'Error'],
  ]

  it.each(cases)('maps "%s" → "%s"', (input, expected) => {
    expect(statusLabel(input)).toBe(expected)
  })

  it('passes through unknown statuses as-is', () => {
    expect(statusLabel('mystery')).toBe('mystery')
  })
})
