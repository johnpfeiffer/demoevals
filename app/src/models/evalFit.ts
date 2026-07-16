import type { EvalId } from './evalLoop'

// Transparent rule-based evaluators. Each eval is a lexicon lookup so a viewer
// can trace exactly why a live LLM candidate received its fit score. This is
// the cheapest evaluator class ($0, instant) in contrast to an LLM-as-judge.

export type FitResult = { fit: number; reason: string }

const LOGICAL_SERIES: Record<string, FitResult> = {
  green: { fit: 100, reason: 'completes the RGB primaries' },
  yellow: { fit: 85, reason: 'primary/rainbow color continues the series' },
  orange: { fit: 75, reason: 'rainbow color continues the series' },
  purple: { fit: 75, reason: 'rainbow color continues the series' },
  violet: { fit: 75, reason: 'rainbow color continues the series' },
  indigo: { fit: 75, reason: 'rainbow color continues the series' },
  cyan: { fit: 70, reason: 'additive color continues the series' },
  magenta: { fit: 70, reason: 'additive color continues the series' },
  pink: { fit: 55, reason: 'color word, weaker series fit' },
  brown: { fit: 50, reason: 'color word, weaker series fit' },
  black: { fit: 50, reason: 'color word, weaker series fit' },
  gray: { fit: 50, reason: 'color word, weaker series fit' },
  grey: { fit: 50, reason: 'color word, weaker series fit' },
  white: { fit: 45, reason: 'color word, but not a series continuation' },
  spectrum: { fit: 45, reason: 'relates to the color sequence' },
  teal: { fit: 70, reason: 'color word continues the series' },
  turquoise: { fit: 70, reason: 'color word continues the series' },
  crimson: { fit: 60, reason: 'color word continues the series' },
  maroon: { fit: 55, reason: 'color word continues the series' },
  gold: { fit: 55, reason: 'color word continues the series' },
  silver: { fit: 55, reason: 'color word continues the series' },
}

const AMERICANA: Record<string, FitResult> = {
  white: { fit: 100, reason: 'red, white, and blue' },
  stars: { fit: 100, reason: 'flag imagery' },
  stripes: { fit: 100, reason: 'flag imagery' },
  america: { fit: 100, reason: 'direct reference' },
  american: { fit: 90, reason: 'direct reference' },
  flag: { fit: 85, reason: 'flag imagery' },
  eagle: { fit: 80, reason: 'national symbol' },
  liberty: { fit: 80, reason: 'national symbol' },
  freedom: { fit: 75, reason: 'patriotic theme' },
  banner: { fit: 70, reason: 'star-spangled banner' },
  glory: { fit: 70, reason: 'old glory' },
  usa: { fit: 100, reason: 'direct reference' },
  anthem: { fit: 90, reason: 'national anthem' },
  independence: { fit: 90, reason: 'independence day' },
  fireworks: { fit: 85, reason: 'fourth of july' },
  patriot: { fit: 85, reason: 'patriotic theme' },
  constitution: { fit: 80, reason: 'founding document' },
  july: { fit: 75, reason: 'fourth of july' },
  baseball: { fit: 70, reason: 'national pastime' },
  parade: { fit: 70, reason: 'fourth of july' },
  capitol: { fit: 70, reason: 'national symbol' },
  cowboy: { fit: 60, reason: 'americana imagery' },
  apple: { fit: 60, reason: 'apple pie' },
  statue: { fit: 60, reason: 'statue of liberty' },
}

const SCIENCE: Record<string, FitResult> = {
  light: { fit: 100, reason: 'color is a property of light' },
  wavelength: { fit: 100, reason: 'physics of color' },
  spectrum: { fit: 100, reason: 'physics of color' },
  photon: { fit: 100, reason: 'physics of light' },
  optics: { fit: 90, reason: 'physics of light' },
  prism: { fit: 85, reason: 'splits light into colors' },
  wave: { fit: 85, reason: 'light as a wave' },
  frequency: { fit: 80, reason: 'physics of color' },
  laser: { fit: 75, reason: 'light technology' },
  energy: { fit: 70, reason: 'physics concept' },
  shift: { fit: 65, reason: 'red/blue shift in astronomy' },
  violet: { fit: 60, reason: 'end of the visible spectrum' },
  infrared: { fit: 85, reason: 'beyond the visible spectrum' },
  ultraviolet: { fit: 85, reason: 'beyond the visible spectrum' },
  refraction: { fit: 90, reason: 'physics of light' },
  reflection: { fit: 80, reason: 'physics of light' },
  quantum: { fit: 80, reason: 'physics concept' },
  physics: { fit: 85, reason: 'the discipline itself' },
  particle: { fit: 80, reason: 'light as a particle' },
  radiation: { fit: 80, reason: 'electromagnetic radiation' },
  atom: { fit: 75, reason: 'physics concept' },
  electron: { fit: 75, reason: 'physics concept' },
  relativity: { fit: 75, reason: 'physics concept' },
  gravity: { fit: 70, reason: 'physics concept' },
}

const LEXICONS: Record<EvalId, Record<string, FitResult>> = {
  logical: LOGICAL_SERIES,
  americana: AMERICANA,
  science: SCIENCE,
}

export function fitFor(word: string, id: EvalId): FitResult {
  const entry = LEXICONS[id][word.toLowerCase()]
  return entry ?? { fit: 0, reason: 'not in this eval’s lexicon' }
}

export function fitsFor(word: string): Record<EvalId, number> {
  return {
    logical: fitFor(word, 'logical').fit,
    americana: fitFor(word, 'americana').fit,
    science: fitFor(word, 'science').fit,
  }
}
