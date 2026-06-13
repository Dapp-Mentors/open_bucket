import { PIPELINE_STEPS } from '../frontend/src/types'

describe('PIPELINE_STEPS', () => {
  it('contains exactly 5 steps', () => {
    expect(PIPELINE_STEPS).toHaveLength(5)
  })

  it('starts at 0% and ends at 100%', () => {
    expect(PIPELINE_STEPS[0].pct).toBe(0)
    expect(PIPELINE_STEPS[PIPELINE_STEPS.length - 1].pct).toBe(100)
  })

  it('progress percentages are non-decreasing', () => {
    for (let i = 1; i < PIPELINE_STEPS.length; i++) {
      expect(PIPELINE_STEPS[i].pct).toBeGreaterThanOrEqual(PIPELINE_STEPS[i - 1].pct)
    }
  })

  it('step keys match expected pipeline order', () => {
    const keys = PIPELINE_STEPS.map(s => s.key)
    expect(keys).toEqual(['queued', 'uploading', 'pinning', 'indexing', 'ready'])
  })

  it('every step has a non-empty label and desc', () => {
    for (const step of PIPELINE_STEPS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.desc.length).toBeGreaterThan(0)
    }
  })

  it('"ready" step is at 100%', () => {
    const ready = PIPELINE_STEPS.find(s => s.key === 'ready')
    expect(ready).toBeDefined()
    expect(ready!.pct).toBe(100)
  })
})
