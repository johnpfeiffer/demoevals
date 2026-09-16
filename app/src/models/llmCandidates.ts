import { fitsFor } from './evalFit'
import type { CandidateDefinition } from './evalLoop'

// Live candidates come from an OpenAI-compatible provider selected by the
// shared backend. The frontend owns generation input, not provider config.

const ENDPOINT = '/api/openai/chat/completions'
export const CANDIDATE_COUNT = 6

export function buildGenerationRequest(context: string[], steering = '') {
  const steeringSuffix = steering
    ? `\n\nApply these preferences when proposing candidates:\n${steering}`
    : ''
  return {
    temperature: 1.0,
    top_p: 0.95,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content:
          'You suggest single-word continuations of a word sequence, and you also act as a judge scoring each candidate against evaluation rubrics. Rubrics: logical = continues the logical/color series; americana = fits the red-white-and-blue American patriotic theme; science = fits the physics of light and color, or scientific vocabulary. Judge fits on meaning, independently of plausibility. Respond only with JSON matching the schema.',
      },
      {
        role: 'user',
        content: `The sequence so far: ${context.join(', ')}. Propose exactly ${CANDIDATE_COUNT} distinct plausible next words (lowercase, single words, no punctuation). For each give: plausibility 0-100 for how naturally it continues the sequence, and fits scoring the word 0-100 against each rubric (logical, americana, science).${steeringSuffix}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'candidates',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  word: { type: 'string' },
                  plausibility: { type: 'integer' },
                  fits: {
                    type: 'object',
                    properties: {
                      logical: { type: 'integer' },
                      americana: { type: 'integer' },
                      science: { type: 'integer' },
                    },
                    required: ['logical', 'americana', 'science'],
                    additionalProperties: false,
                  },
                },
                required: ['word', 'plausibility', 'fits'],
                additionalProperties: false,
              },
            },
          },
          required: ['candidates'],
          additionalProperties: false,
        },
      },
    },
  }
}

const clampScore = (value: unknown): number | null => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, Math.round(numeric))) : null
}

// Pure and testable: normalizes the model's JSON into candidate definitions.
// Judge fits (scored by the model against each rubric) are used when present
// and valid; otherwise fits fall back to the lexicon rules.
export function parseCandidateContent(content: string): CandidateDefinition[] {
  const parsed: unknown = JSON.parse(content)
  const list = (parsed as { candidates?: unknown }).candidates
  if (!Array.isArray(list)) throw new Error('LLM response missing candidates array')
  const seen = new Set<string>()
  const definitions: CandidateDefinition[] = []
  for (const item of list) {
    const word = String((item as { word?: unknown }).word ?? '')
      .toLowerCase()
      .replace(/[^a-z-]/g, '')
    const plausibility = clampScore((item as { plausibility?: unknown }).plausibility)
    if (!word || seen.has(word) || plausibility === null) continue
    seen.add(word)
    const rawFits = (item as { fits?: Record<string, unknown> }).fits
    const logical = clampScore(rawFits?.logical)
    const americana = clampScore(rawFits?.americana)
    const science = clampScore(rawFits?.science)
    const judgeFits =
      logical !== null && americana !== null && science !== null
        ? { logical, americana, science }
        : null
    definitions.push({
      word,
      base: plausibility,
      fits: judgeFits ?? fitsFor(word),
      fitSource: judgeFits ? 'judge' : 'lexicon',
    })
    if (definitions.length === CANDIDATE_COUNT) break
  }
  if (definitions.length === 0) throw new Error('LLM response contained no usable candidates')
  return definitions
}

export async function fetchLlmCandidates(
  context: string[],
  steering = '',
  fetchImpl: typeof fetch = fetch,
): Promise<CandidateDefinition[]> {
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGenerationRequest(context, steering)),
  })
  if (!response.ok) {
    throw new Error(`LLM API error ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  const payload = (await response.json()) as {
    model?: string
    choices?: { message?: { content?: string } }[]
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM API returned no message content')
  return parseCandidateContent(content)
}
