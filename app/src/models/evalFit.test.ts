import { describe, expect, it } from 'vitest'
import { fitFor, fitsFor } from './evalFit'

describe('rule-based eval fit', () => {
  it('scores the canonical seed examples', () => {
    expect(fitFor('green', 'logical').fit).toBe(100)
    expect(fitFor('white', 'americana').fit).toBe(100)
    expect(fitFor('light', 'science').fit).toBe(100)
  })

  it('gives unknown words zero fit with a stated reason', () => {
    const result = fitFor('zebra', 'logical')
    expect(result.fit).toBe(0)
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('is case-insensitive and covers all evals', () => {
    expect(fitsFor('WHITE')).toEqual({
      logical: fitFor('white', 'logical').fit,
      americana: 100,
      science: fitFor('white', 'science').fit,
    })
  })
})
