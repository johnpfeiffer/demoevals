import { describe, expect, it } from 'vitest'
import { buildGenerationRequest, parseCandidateContent } from './llmCandidates'

describe('llm candidate source', () => {
  it('normalizes a structured-output response into candidate definitions', () => {
    const content = JSON.stringify({
      candidates: [
        { word: 'Green!', plausibility: 82 },
        { word: 'white', plausibility: 64 },
        { word: 'white', plausibility: 10 },
        { word: 'light', plausibility: 150 },
      ],
    })
    const definitions = parseCandidateContent(content)
    expect(definitions.map(({ word }) => word)).toEqual(['green', 'white', 'light'])
    expect(definitions[0].base).toBe(82)
    expect(definitions[2].base).toBe(100)
    expect(definitions[0].fits.logical).toBe(100)
    expect(definitions[1].fits.americana).toBe(100)
  })

  it('throws on responses without usable candidates', () => {
    expect(() => parseCandidateContent('{"candidates": []}')).toThrow()
    expect(() => parseCandidateContent('{"unexpected": true}')).toThrow()
  })

  it('requests strict structured output without selecting the backend model', () => {
    const request = buildGenerationRequest(['red', 'blue'])
    expect(request).not.toHaveProperty('model')
    expect(request.response_format.json_schema.strict).toBe(true)
    expect(request.messages[1].content).toContain('red, blue')
  })

  it('uses judge fits when present, lexicon fallback when absent', () => {
    const judged = parseCandidateContent(JSON.stringify({
      candidates: [{ word: 'microscope', plausibility: 40, fits: { logical: 5, americana: 0, science: 88 } }],
    }))
    expect(judged[0].fits.science).toBe(88)
    expect(judged[0].fitSource).toBe('judge')
    const fallback = parseCandidateContent(JSON.stringify({
      candidates: [{ word: 'white', plausibility: 60 }],
    }))
    expect(fallback[0].fits.americana).toBe(100)
    expect(fallback[0].fitSource).toBe('lexicon')
  })

  it('requests judge fits in the strict schema', () => {
    const request = buildGenerationRequest(['red', 'blue'])
    const schema = request.response_format.json_schema.schema.properties.candidates.items
    expect(schema.required).toContain('fits')
    expect(schema.properties.fits.required).toEqual(['logical', 'americana', 'science'])
  })

  it('includes steering text only when provided', () => {
    const steered = buildGenerationRequest(['red', 'blue'], '- Prefer americana continuations (influence: 100%).')
    expect(steered.messages[1].content).toContain('americana')
    expect(buildGenerationRequest(['red', 'blue']).messages[1].content).not.toContain('preferences')
  })
})
