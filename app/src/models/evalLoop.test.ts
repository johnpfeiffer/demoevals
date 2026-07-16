import { describe, expect, it } from 'vitest'
import { advanceLoop, buildPrompt, deterministicCandidates, evaluateCandidates, filterRepeats, scoreCandidates } from './evalLoop'

describe('eval loop', () => {
  it('lets the logical series eval steer red, blue toward green', () => {
    const candidates = evaluateCandidates(['red', 'blue'], [{ id: 'logical', weight: 100 }])
    expect(candidates[0].word).toBe('green')
  })

  it('appends the evaluated selection to the next context', () => {
    const result = advanceLoop(['red', 'blue'], [{ id: 'science', weight: 100 }])
    expect(result.context).toEqual(['red', 'blue', 'light'])
  })

  it('the repeat gate breaks the green/yellow logical loop', () => {
    const context = ['red', 'blue', 'green', 'yellow']
    const gated = filterRepeats(deterministicCandidates(context), context)
    const winner = scoreCandidates(gated, [{ id: 'logical', weight: 100 }])[0]
    expect(['green', 'yellow']).not.toContain(winner.word)
  })

  it('without the gate, americana legitimately repeats blue after white', () => {
    const context = ['red', 'blue', 'white']
    const winner = scoreCandidates(deterministicCandidates(context), [{ id: 'americana', weight: 100 }])[0]
    expect(winner.word).toBe('blue')
  })

  it('logical steering with the gate walks a long distinct color trajectory', () => {
    let context = ['red', 'blue']
    for (let step = 0; step < 12; step += 1) {
      const gated = filterRepeats(deterministicCandidates(context), context)
      context = [...context, scoreCandidates(gated, [{ id: 'logical', weight: 100 }])[0].word]
    }
    expect(new Set(context).size).toBe(context.length)
    expect(context).toContain('orange')
  })

  it('science and americana steering also continue their themes', () => {
    const science = scoreCandidates(deterministicCandidates(['red', 'blue', 'light', 'spectrum']), [{ id: 'science', weight: 100 }])[0]
    expect(science.word).toBe('wavelength')
    const americana = scoreCandidates(deterministicCandidates(['red', 'blue', 'white', 'stars']), [{ id: 'americana', weight: 100 }])[0]
    expect(americana.word).toBe('stripes')
  })

  it('at 100% influence the eval verdict overrides a higher base likelihood', () => {
    const candidates = [
      { word: 'microscope', base: 40, fits: { logical: 5, americana: 0, science: 88 } },
      { word: 'green', base: 80, fits: { logical: 95, americana: 5, science: 30 } },
    ]
    expect(scoreCandidates(candidates, [{ id: 'science', weight: 100 }])[0].word).toBe('microscope')
    expect(scoreCandidates(candidates, [])[0].word).toBe('green')
  })

  it('the auto-tuned prompt states the repeat constraint only when the gate is on', () => {
    expect(buildPrompt([{ id: 'logical', weight: 70 }], true)).toContain('Never repeat')
    expect(buildPrompt([{ id: 'logical', weight: 70 }], false)).not.toContain('Never repeat')
  })

  it('the gate falls back to unfiltered candidates rather than returning none', () => {
    const definitions = deterministicCandidates(['red', 'blue'])
    const everything = definitions.map(({ word }) => word)
    expect(filterRepeats(definitions, everything)).toEqual(definitions)
  })
})
