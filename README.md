# demoevals

A TypeScript MVP that makes an LLM evaluation loop inspectable. Start with
`red, blue`, vary the influence of three evals, inspect the candidate scores,
and commit the selected next word back into the loop.

Two candidate sources, switchable in the UI:

- Offline sampler (default): deterministic candidates so the causal effect of
  each eval is legible without credentials or network.
- Live LLM: a backend-selected OpenAI-compatible provider proposes candidates
  via structured output (one request per loop step). Eval fit is then scored
  by transparent lexicon rules in the browser, so moving a slider rescores
  the same candidates without extra API calls.

The generated prompt illustrates the separate auto-tuning loop: selected
evals become prompt preferences.

## Setup

Offline mode needs no credentials or backend. Live mode calls the same-origin
`/api/openai/chat/completions` route supplied by the shared deployment backend.
The frontend sends no model or provider configuration. The backend must keep
`OPENAI_API_BASE`, `OPENAI_API_KEY`, and `OPENAI_MODEL` server-side, inject the
model, and enforce `metadata.completion_window = "balanced"`.

Plain Vite development supports the offline experience. To use Live LLM
locally, serve the app behind a backend or reverse proxy that implements the
same route; never expose the backend variables through `VITE_*` variables or
the browser bundle.

## Local development

Use Node 24.20.0, then install the committed dependency tree:

```sh
cd app
npm ci
npm run dev -- --host 0.0.0.0 --port 8080
```

Open http://localhost:8080.

## Checks

```sh
cd app
npm test
npm run build
```

## Shared backend contract

The deployment backend owns credentials, provider selection, model selection,
request limits, and the balanced completion window. It accepts the standard
OpenAI Chat Completions body without a frontend-supplied `model`, injects its
configured model, and returns the standard response shape. Generated content
is read from `choices[0].message.content`; the top-level `model` reports which
model the backend used.

Verify a deployment route with:

```sh
curl -sS https://<your-deployment>/api/openai/chat/completions \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"say ok"}]}'
```
