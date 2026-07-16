# demoevals

A TypeScript MVP that makes an LLM evaluation loop inspectable. Start with
`red, blue`, vary the influence of three evals, inspect the candidate scores,
and commit the selected next word back into the loop.

Two candidate sources, switchable in the UI:

- Offline sampler (default): deterministic candidates so the causal effect of
  each eval is legible without credentials or network.
- Live LLM: `gemma-4-31b` on Cerebras proposes candidates via structured
  output (one request per loop step). Eval fit is then scored by transparent
  lexicon rules in the browser, so moving a slider rescores the same
  candidates without extra API calls.

The generated prompt illustrates the separate auto-tuning loop: selected
evals become prompt preferences.

## Setup

For live mode, put your Cerebras API key in `.env` at the repository root:

```sh
CEREBRAS_API_KEY=csk-...
```

The Vite dev server proxies `/api/cerebras/*` to `https://api.cerebras.ai/v1`
and injects the key server-side, so it never reaches the browser. Restart the
dev server after changing `.env`. Without a key, live mode shows a warning and
falls back to the offline sampler.

## Local development

```sh
cd app
npm install
npm run dev -- --host 0.0.0.0 --port 8080
```

Open http://localhost:8080.

## Checks

```sh
cd app
npm test
npm run build
```

## Deploy to Cloudflare

The Cerebras backend lives in `functions/cerebras/` (provider client,
request handler, optional CORS middleware — same layout as the imported
Gemini/Workers-AI examples) and is tested with plain node:

```sh
node --test functions/cerebras/*.test.mjs
```

A single Worker (`app/worker/index.mjs`, config in `app/wrangler.jsonc`) is
thin glue: it serves the built SPA as static assets and mounts
`/api/cerebras/chat/completions` with the key held in a Worker secret. The
route is intentionally narrow: POST only, model pinned to `gemma-4-31b`,
`max_tokens` clamped, streaming disabled — so the public endpoint cannot be
repurposed. `functions/cerebras/cors.mjs` is only needed if you mount the
route on a shared multi-app Worker domain instead.

```sh
cd app
npm run build
npx wrangler secret put CEREBRAS_API_KEY   # paste the key when prompted
npx wrangler deploy
```

To try the Worker locally (instead of the Vite dev proxy), put
`CEREBRAS_API_KEY=csk-...` in `app/.dev.vars` (gitignored) and run
`npx wrangler dev` after a build. Verify a deploy with:

```sh
curl -sS https://<your-worker>.workers.dev/api/cerebras/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gemma-4-31b","messages":[{"role":"user","content":"say ok"}]}'
```
