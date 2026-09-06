import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  FormControlLabel,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Switch,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import {
  EVALS,
  INITIAL_CONTEXT,
  buildPrompt,
  buildSteering,
  deterministicCandidates,
  filterRepeats,
  scoreCandidates,
  type CandidateDefinition,
  type EvalId,
} from './models/evalLoop'
import { LLM_MODEL, fetchLlmCandidates } from './models/llmCandidates'
import { fitsFor } from './models/evalFit'
import Footer from './Footer'

const theme = createTheme({
  palette: { mode: 'light' },
  typography: { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
})

type EvalSettings = Record<EvalId, { enabled: boolean; weight: number }>

const initialSettings: EvalSettings = {
  logical: { enabled: true, weight: 70 },
  americana: { enabled: true, weight: 55 },
  science: { enabled: true, weight: 45 },
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value}%</Typography>
      </Stack>
      <LinearProgress
        aria-label={`${label}: ${value}%`}
        variant="determinate"
        value={value}
        sx={{ height: 6, mt: 0.5, borderRadius: 3 }}
      />
    </Box>
  )
}

function App() {
  const [context, setContext] = useState<string[]>(INITIAL_CONTEXT)
  const [settings, setSettings] = useState<EvalSettings>(initialSettings)
  const [lastChosen, setLastChosen] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const [blockRepeats, setBlockRepeats] = useState(true)
  const [steer, setSteer] = useState(false)
  const [judgeScoring, setJudgeScoring] = useState(true)
  const [llmDefinitions, setLlmDefinitions] = useState<CandidateDefinition[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)

  const activeEvals = useMemo(
    () => EVALS.filter(({ id }) => settings[id].enabled).map(({ id }) => ({ id, weight: settings[id].weight })),
    [settings],
  )

  // In live mode, fetch fresh candidates from the LLM whenever the context
  // grows. Eval sliders rescore the same fetched candidates client-side, so
  // the selection pressure stays inspectable without extra API calls.
  // Deliberately not re-fetching on slider changes (rate limits): the steering
  // text is captured at fetch time, i.e. it applies from the next step onward.
  useEffect(() => {
    if (!liveMode) return
    let cancelled = false
    setLoading(true)
    setLlmError(null)
    fetchLlmCandidates(context, steer ? buildSteering(activeEvals, blockRepeats) : '')
      .then((definitions) => {
        if (!cancelled) setLlmDefinitions(definitions)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLlmDefinitions(null)
          setLlmError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, context, steer])

  const usingLlm = liveMode && llmDefinitions !== null
  // Judge fits arrive with the candidates; lexicon fits are computed locally.
  // Both are available per fetch, so switching scorer never costs an API call.
  const sourceDefinitions = usingLlm
    ? judgeScoring
      ? llmDefinitions
      : llmDefinitions.map((definition) => ({ ...definition, fits: fitsFor(definition.word), fitSource: 'lexicon' as const }))
    : deterministicCandidates(context)
  const definitions = blockRepeats ? filterRepeats(sourceDefinitions, context) : sourceDefinitions
  const candidates = useMemo(() => scoreCandidates(definitions, activeEvals), [definitions, activeEvals])
  const next = candidates[0]
  const prompt = buildPrompt(activeEvals, blockRepeats)

  const updateEval = (id: EvalId, change: Partial<EvalSettings[EvalId]>) => {
    setSettings((current) => ({ ...current, [id]: { ...current[id], ...change } }))
  }

  const advance = () => {
    if (!next) return
    setContext((current) => [...current, next.word])
    setLastChosen(next.word)
  }

  const reset = () => {
    setContext(INITIAL_CONTEXT)
    setSettings(initialSettings)
    setLastChosen(null)
    setLlmDefinitions(null)
    setLlmError(null)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box component="main" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              Evals, as selection pressure
            </Typography>
            <Typography color="text.secondary">
              A small, inspectable language loop. The model offers possible next words; your evals reshape
              which word wins before it becomes the next bit of context.
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="overline" color="text.secondary">1. Current context</Typography>
              <Stack direction="row" spacing={1} useFlexGap aria-label="Current context words" sx={{ flexWrap: 'wrap' }}>
                {context.map((word, index) => <Chip key={`${word}-${index}`} label={word} />)}
                <Chip label="next word?" variant="outlined" />
              </Stack>
              <Divider />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Typography variant="body2" color="text.secondary">
                  {liveMode
                    ? `Candidates come from ${LLM_MODEL} on Cerebras (one request per step). Eval fits are scored by ${judgeScoring ? 'the model as judge, in the same call — note it is judging its own proposals' : 'transparent lexicon rules ($0, but blind to words outside the lists)'}.`
                    : 'This mode uses a transparent, fixed candidate sampler rather than an API, so every score can be examined offline.'}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={<Switch checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />}
                    label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>Live LLM</Typography>}
                    sx={{ m: 0 }}
                  />
                  {liveMode && (
                    <Tooltip
                      describeChild
                      title={`For demo efficiency (and free-tier rate limits) the same ${LLM_MODEL} call that proposes candidates also judges them against each rubric. Self-judging risks self-preference bias; production systems typically use a separate judge call, often a different model. Off = the app's transparent lexicon rules score the fits instead.`}
                    >
                      <FormControlLabel
                        control={<Switch checked={judgeScoring} onChange={(event) => setJudgeScoring(event.target.checked)} />}
                        label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>LLM judge</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              {liveMode && llmError && (
                <Alert severity="warning">
                  Live candidates unavailable ({llmError}). Showing the offline sampler instead. Check that
                  the Cerebras Pages Function has a CEREBRAS_API_KEY secret configured.
                </Alert>
              )}
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, .86fr) minmax(0, 1.7fr)' }, gap: 3 }}>
            <Paper component="section" variant="outlined" sx={{ p: 2.5 }} aria-labelledby="evals-heading">
              <Stack spacing={2.25}>
                <Box>
                  <Typography id="evals-heading" variant="h6">2. Evals steer the choice</Typography>
                  <Typography variant="body2" color="text.secondary">Turn an eval on, then decide how much it matters.</Typography>
                </Box>
                <Typography variant="overline" color="text.secondary">Preferences (weighted)</Typography>
                {EVALS.map((evalDefinition) => {
                  const setting = settings[evalDefinition.id]
                  return (
                    <Box key={evalDefinition.id}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={setting.enabled}
                            onChange={(event) => updateEval(evalDefinition.id, { enabled: event.target.checked })}
                          />
                        }
                        label={<Box><Typography variant="body1">{evalDefinition.name}</Typography><Typography variant="body2" color="text.secondary">{evalDefinition.hint}</Typography></Box>}
                        sx={{ alignItems: 'flex-start', m: 0 }}
                      />
                      <Box sx={{ pl: 0.5, pr: 1, pt: 1 }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Influence</Typography>
                          <Typography variant="body2" color="text.secondary">{setting.weight}%</Typography>
                        </Stack>
                        <Slider
                          aria-label={`${evalDefinition.name} influence`}
                          disabled={!setting.enabled}
                          value={setting.weight}
                          onChange={(_, value) => updateEval(evalDefinition.id, { weight: value as number })}
                          size="small"
                        />
                      </Box>
                    </Box>
                  )
                })}
                <Divider />
                <Typography variant="overline" color="text.secondary">Constraints (pass/fail)</Typography>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={blockRepeats}
                        onChange={(event) => setBlockRepeats(event.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">Block repeated words</Typography>
                        <Typography variant="body2" color="text.secondary">
                          A hard deterministic gate, not a weighted preference.
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }} aria-labelledby="candidates-heading">
              <Stack spacing={2.25}>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                    <Typography id="candidates-heading" variant="h6">3. Candidate words, rescored</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={usingLlm ? 'success' : 'default'}
                      label={usingLlm ? `live${steer ? '+steered' : ''}: ${LLM_MODEL}` : 'offline sampler'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Base likelihood is the model’s starting preference. Influence decides how much of the verdict the
                    evals take from it: at 100% combined influence, weighted eval fit fully decides.
                  </Typography>
                </Box>

                {loading && (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }} aria-live="polite">
                    <CircularProgress size={18} aria-label="Fetching live candidates" />
                    <Typography variant="body2" color="text.secondary">Asking {LLM_MODEL} for candidates…</Typography>
                  </Stack>
                )}

                <Box sx={{ display: 'grid', gap: 1.75, opacity: loading ? 0.5 : 1 }}>
                  {candidates.map((candidate, index) => {
                    const unscored = activeEvals.length > 0 && activeEvals.every(({ id }) => candidate.fits[id] === 0)
                    const wordSource = usingLlm ? `Proposed by ${LLM_MODEL}.` : 'Proposed by the app’s fixed sampler (not a model).'
                    const fitSource =
                      candidate.fitSource === 'judge'
                        ? `Eval fits judged by ${LLM_MODEL} in the same call.`
                        : candidate.fitSource === 'lexicon'
                          ? 'Eval fits from the app’s word lists — a word outside the lists scores 0 even if it fits the theme.'
                          : 'Eval fits hand-authored in the app.'
                    return (
                      <Box key={candidate.word} sx={{ display: 'grid', gridTemplateColumns: { xs: '92px minmax(0, 1fr)', sm: '150px minmax(0, 1fr)' }, gap: 2, alignItems: 'center' }}>
                        <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Tooltip title={`${wordSource} ${fitSource}`}>
                            <Typography variant="h6" component="span">{candidate.word}</Typography>
                          </Tooltip>
                          {index === 0 && <Chip size="small" label="chosen" color="primary" />}
                          {unscored && (
                            <Tooltip title={`No active eval gave this word any fit, so its score is pure base likelihood. ${candidate.fitSource === 'lexicon' ? 'With lexicon scoring this often means the app’s word lists don’t recognize the word — the evaluator, not the model, is the constraint.' : ''}`}>
                              <Chip size="small" variant="outlined" color="warning" label="unscored" />
                            </Tooltip>
                          )}
                        </Stack>
                        <Stack spacing={0.75}>
                          <ScoreBar label={`Model ${candidate.base}%`} value={candidate.base} />
                          <ScoreBar label={`After evals ${candidate.final}%`} value={candidate.final} />
                        </Stack>
                      </Box>
                    )
                  })}
                </Box>

                {activeEvals.length === 0 ? (
                  <Alert severity="info">No evals are active, so the model’s base likelihood decides.</Alert>
                ) : next ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Why “{next.word}” wins</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {next.contributions.filter(({ points }) => points > 0).map(({ id, points }) => (
                        <Chip key={id} size="small" label={`${EVALS.find((evalDefinition) => evalDefinition.id === id)?.name}: +${points}`} />
                      ))}
                      {next.contributions.every(({ points }) => points === 0) && (
                        <Typography variant="body2" color="text.secondary">
                          No active eval matched, so base likelihood decided.
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
              <Box>
                <Typography variant="overline" color="text.secondary">4. Commit the result</Typography>
                <Typography variant="h5">Next word: {next ? next.word : '…'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastChosen ? `Last committed word: ${lastChosen}. ` : ''}Every commit gives the next generation a changed context.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={reset}>Reset</Button>
                <Button variant="contained" onClick={advance} disabled={loading || !next}>
                  {next ? `Choose “${next.word}”` : 'Waiting…'}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper component="details" variant="outlined" sx={{ p: 2 }}>
            <summary><Typography component="span" variant="body2">Show the auto-tuned prompt</Typography></summary>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', mb: 0, mt: 2, fontFamily: 'monospace', fontSize: 14 }}>
              {prompt}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <FormControlLabel
              control={<Switch checked={steer} onChange={(event) => setSteer(event.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body1">Send this prompt with live generation</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {steer
                      ? 'Steering upstream: the model is asked to propose candidates that already fit the preferences. Slider changes apply from the next step.'
                      : 'Off: the live request is neutral, and evals act only as downstream selection pressure over whatever the model proposes.'}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Paper>

          <Footer />
        </Stack>
      </Box>
    </ThemeProvider>
  )
}

export default App
