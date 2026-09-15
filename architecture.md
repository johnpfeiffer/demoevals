# Architecture

The app keeps the evaluation domain separate from the React view. There are
two candidate sources: a transparent deterministic sampler (offline default)
and a live Cerebras-hosted LLM selected by the backend. In both cases eval scoring and
winner selection happen client-side in the models layer, so a viewer can trace
exactly why one continuation wins.

```mermaid
flowchart LR
  C[Current context] --> G{Candidate source}
  G -->|offline| D[Deterministic sampler]
  G -->|live| L[Cerebras LLM via /api/cerebras proxy]
  L --> F[Lexicon eval fit scoring]
  D --> R[Repeat gate optional]
  F --> R
  R --> S[Score candidates]
  E[Enabled evals and weights] --> S
  S --> V[React visual interface]
  V --> FOOT[Footer: built-by line + LinkedIn / GitHub source links]
  S --> W[Winning word]
  W --> C
  E --> P[Auto-tuned prompt preview]
```

The Vite dev/preview server proxies `/api/cerebras/*` to
`https://api.cerebras.ai/v1` and injects `CEREBRAS_API_KEY` from the
repository root `.env`, keeping the key out of the client bundle. In
production the same path is served by a Cloudflare Worker: the backend logic
lives in `functions/cerebras/` (`cerebras.mjs` provider client with
injectable fetch, `worker.mjs` request validation/error mapping, `cors.mjs`
for shared-domain mounting), tested via `node --test`; `app/worker/index.mjs`
is thin glue that mounts the route and serves the built SPA as static assets.
The key is a Worker secret and the route validates request shape (server-owned
model selection, clamped max_tokens, no streaming) so the public endpoint cannot be
repurposed. The client is identical in both environments. Live mode
makes one structured-output request per loop step; eval sliders rescore the
already-fetched candidates locally.

## User journey

```mermaid
flowchart TD
  A[Open with red, blue] --> B[Inspect candidate base likelihood]
  B --> M{Toggle Live LLM?}
  M -->|off| C[Enable evals and set influence]
  M -->|on| L[Fetch candidates from Cerebras, spinner while waiting]
  L --> C
  C --> D[See rescored candidate words]
  D --> E[Commit the winning word]
  E --> F[Expanded context feeds the next loop, live mode refetches]
  F --> G[Footer credits the author and links to the source]
```

## Modules

- `app/src/models/evalLoop.ts` — candidate scoring, winner selection, prompt
  preview construction, deterministic sampler, and the repeat gate
  (`filterRepeats`): a hard deterministic gate that drops candidates already
  in the context, illustrating gate-vs-pressure. It is a UI toggle (default
  on) because repetition is sometimes legitimate (americana: red, white,
  blue, white…), and it falls back to the unfiltered list rather than
  returning zero candidates.
- `app/src/models/evalFit.ts` — rule-based (lexicon) evaluators that score any
  word's fit per eval, with a human-readable reason. The $0/instant evaluator
  class, in contrast to an LLM-as-judge.
- `app/src/models/llmCandidates.ts` — builds a model-agnostic structured-output
  request, parses/normalizes the response, and fetches via the proxy. The backend
  owns provider model selection. By default the
  generation prompt is neutral, so evals act purely as downstream selection
  pressure — which cannot inject a theme the model never proposes. A toggle
  in the prompt panel closes the auto-tuning loop: the steering block
  (`buildSteering`) is sent with each live request, shaping proposals
  upstream. The chip in the candidates panel shows which regime is active
  (offline sampler / live / live+steered).
- `app/src/App.tsx` — interactive state and rendering only; owns the
  source toggle, loading and error states.
- `app/src/Footer.tsx` — pure presentational footer rendered at the bottom
  of the page; a "Built by John Pfeiffer" line with LinkedIn and GitHub
  source links (`@mui/icons-material` marks). Covered by a jsdom component
  test (`Footer.test.tsx`).
