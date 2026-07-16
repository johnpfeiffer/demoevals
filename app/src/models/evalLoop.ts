import { fitsFor } from './evalFit'

export const INITIAL_CONTEXT = ['red', 'blue']

export type EvalId = 'logical' | 'americana' | 'science'

export type ActiveEval = { id: EvalId; weight: number }

export type FitSource = 'judge' | 'lexicon' | 'curated'

export type CandidateDefinition = {
  word: string
  base: number
  fits: Record<EvalId, number>
  // Provenance of the fit scores, so the UI can show when the evaluator
  // (rather than the model) is the binding constraint.
  fitSource?: FitSource
}

export type Candidate = CandidateDefinition & {
  final: number
  contributions: { id: EvalId; points: number }[]
}

export const EVALS: { id: EvalId; name: string; hint: string }[] = [
  { id: 'logical', name: 'Logical series', hint: 'colors, RGB, sequence' },
  { id: 'americana', name: 'Americana', hint: 'red, white, and blue' },
  { id: 'science', name: 'Science', hint: 'light, wavelength, optics' },
]

const INITIAL_CANDIDATES: CandidateDefinition[] = [
  { word: 'green', base: 52, fits: { logical: 100, americana: 4, science: 16 } },
  { word: 'white', base: 44, fits: { logical: 5, americana: 100, science: 12 } },
  { word: 'light', base: 35, fits: { logical: 8, americana: 6, science: 100 } },
  { word: 'violet', base: 28, fits: { logical: 62, americana: 2, science: 72 } },
]

const FOLLOW_UP_CANDIDATES: Record<string, CandidateDefinition[]> = {
  green: [
    { word: 'yellow', base: 52, fits: { logical: 100, americana: 3, science: 18 } },
    { word: 'white', base: 42, fits: { logical: 4, americana: 100, science: 11 } },
    { word: 'light', base: 34, fits: { logical: 8, americana: 5, science: 100 } },
    { word: 'cyan', base: 27, fits: { logical: 78, americana: 1, science: 68 } },
  ],
  white: [
    { word: 'blue', base: 50, fits: { logical: 42, americana: 100, science: 19 } },
    { word: 'light', base: 44, fits: { logical: 7, americana: 9, science: 100 } },
    { word: 'stars', base: 31, fits: { logical: 3, americana: 75, science: 64 } },
    { word: 'violet', base: 28, fits: { logical: 60, americana: 2, science: 72 } },
  ],
  light: [
    { word: 'spectrum', base: 51, fits: { logical: 48, americana: 1, science: 100 } },
    { word: 'green', base: 42, fits: { logical: 100, americana: 4, science: 18 } },
    { word: 'white', base: 36, fits: { logical: 4, americana: 100, science: 12 } },
    { word: 'wave', base: 30, fits: { logical: 28, americana: 1, science: 86 } },
  ],
}

// Influence semantics: the sliders decide how much of the verdict the evals
// take from the model. At a combined influence of 100%+ the weighted eval fit
// fully decides; at 0% base likelihood decides; linear blend in between.
const score = (candidate: CandidateDefinition, activeEvals: ActiveEval[]) => {
  const contributions = activeEvals.map(({ id, weight }) => ({
    id,
    points: Math.round((candidate.fits[id] * weight) / 100),
  }))
  const totalWeight = activeEvals.reduce((total, evalDefinition) => total + evalDefinition.weight, 0)
  if (totalWeight === 0) return { contributions, final: Math.round(candidate.base) }
  const evalScore = activeEvals.reduce((total, { id, weight }) => total + candidate.fits[id] * weight, 0) / totalWeight
  const blend = Math.min(1, totalWeight / 100)
  return { contributions, final: Math.round(candidate.base * (1 - blend) + evalScore * blend) }
}

// Theme chains extend the hardcoded series beyond the hand-authored tables:
// once an eval's reward has been chased into a theme, the natural continuation
// is more of that theme. Fits come from the same lexicons that score live LLM
// candidates, so both sources stay consistent.
const COLOR_CHAIN = ['green', 'yellow', 'orange', 'purple', 'violet', 'indigo', 'cyan', 'magenta', 'pink', 'teal', 'turquoise', 'crimson', 'maroon', 'gold', 'silver']
const SCIENCE_CHAIN = ['light', 'spectrum', 'wave', 'wavelength', 'photon', 'prism', 'refraction', 'optics', 'laser', 'frequency', 'quantum', 'particle', 'physics', 'energy']
const AMERICANA_CHAIN = ['white', 'stars', 'stripes', 'flag', 'eagle', 'liberty', 'freedom', 'anthem', 'banner', 'glory', 'america', 'independence', 'fireworks', 'baseball']
const THEME_CHAINS = [
  { chain: COLOR_CHAIN, entry: 'green' },
  { chain: SCIENCE_CHAIN, entry: 'light' },
  { chain: AMERICANA_CHAIN, entry: 'white' },
]

const define = (word: string, base: number): CandidateDefinition => ({ word, base, fits: fitsFor(word), fitSource: 'lexicon' })

function chainFollowUps(lastWord: string): CandidateDefinition[] | null {
  const theme = THEME_CHAINS.find(({ chain }) => chain.includes(lastWord))
  if (!theme) return null
  const index = theme.chain.indexOf(lastWord)
  const next = theme.chain[(index + 1) % theme.chain.length]
  const after = theme.chain[(index + 2) % theme.chain.length]
  const rivals = THEME_CHAINS.filter((other) => other !== theme).map(({ entry }) => entry)
  return [define(next, 52), define(rivals[0], 40), define(rivals[1], 36), define(after, 27)]
}

// A hard deterministic gate, in contrast to the weighted evals (selection pressure): drop
// candidates already present in the context. Falls back to the unfiltered
// list if the gate would eliminate every candidate.
export function filterRepeats(definitions: CandidateDefinition[], context: string[]): CandidateDefinition[] {
  const used = new Set(context.map((word) => word.toLowerCase()))
  const remaining = definitions.filter(({ word }) => !used.has(word.toLowerCase()))
  return remaining.length > 0 ? remaining : definitions
}

export function scoreCandidates(definitions: CandidateDefinition[], activeEvals: ActiveEval[]): Candidate[] {
  return definitions.map((candidate) => ({ ...candidate, ...score(candidate, activeEvals) }))
    .sort((left, right) => right.final - left.final || right.base - left.base)
}

export function deterministicCandidates(context: string[]): CandidateDefinition[] {
  const lastWord = context[context.length - 1]
  return FOLLOW_UP_CANDIDATES[lastWord] ?? chainFollowUps(lastWord) ?? INITIAL_CANDIDATES
}

export function evaluateCandidates(context: string[], activeEvals: ActiveEval[]): Candidate[] {
  return scoreCandidates(deterministicCandidates(context), activeEvals)
}

export function advanceLoop(context: string[], activeEvals: ActiveEval[]) {
  const chosen = evaluateCandidates(context, activeEvals)[0]
  return { chosen, context: [...context, chosen.word] }
}

// The steering block of the auto-tuned prompt: preferences and constraints
// only, reusable both for display and for sending with live generation.
export function buildSteering(activeEvals: ActiveEval[], blockRepeats = false) {
  const lines: string[] = []
  if (activeEvals.length > 0) {
    lines.push('Selection preferences:')
    for (const { id, weight } of activeEvals) {
      const definition = EVALS.find((evalDefinition) => evalDefinition.id === id)
      lines.push(`- Prefer ${definition?.name.toLowerCase()} continuations, e.g. ${definition?.hint} (influence: ${weight}%).`)
    }
  }
  if (blockRepeats) {
    lines.push('Hard constraints:', '- Never repeat a word already in the sequence.')
  }
  return lines.join('\n')
}

export function buildPrompt(activeEvals: ActiveEval[], blockRepeats = false) {
  const head = activeEvals.length === 0 ? 'Continue with one word.' : 'Continue with exactly one word.'
  const steering = buildSteering(activeEvals, blockRepeats)
  return steering ? [head, steering].join('\n') : head
}
