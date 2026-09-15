I had this idea of an app to visualize how Evals influence (llm) loops.
The app should ask an LLM to generate the next word.

It starts seeded with two words: red, blue (the other part of this is the idea of "auto-tuning" prompts).

So the kinds of evals that could be provided:
- Science = light Does that make senes?
- Logical series = green (colors, RGB)
- Americana = white

# Codex response

> Validated concept, distinguished eval mechanisms, sketched implementation details and visualization strategy

Yes—this is a strong, intuitive way to make evals tangible. Start with red → blue, then show how different evaluators steer the LLM’s next-word choice:

Logical series / colors / RGB → green
Americana → white
Science → light

The key visual loop would be: context → candidate next words → eval scores → selected word → updated context

So the app makes clear that an eval isn’t merely a pass/fail test—it can act as a selection pressure on generation.
“Auto-tuning prompts” fits naturally as a second loop: if an evaluator repeatedly prefers a type of continuation,
the system experiments with prompt wording or weights until the model produces those continuations more reliably before evaluation.

# Claude response

The concept makes sense and the demo is genuinely good pedagogy. Improvements, roughly in order of value:

1. Name the mechanism precisely. What you're describing isn't an eval in the offline-benchmark sense — it's an eval used as a scorer inside a best-of-N selection loop (guided decoding / reranking). Your audience (the evals-as-discipline crowd) will notice the distinction, so make it the point rather than a sloppiness: the app's thesis becomes "the same evaluator can be a gate (pass/fail after the fact) or a selection pressure (inside the loop)." Show both modes with a toggle. That's a sharper claim than "evals influence loops."

2. The killer visual is trajectory divergence, not single steps. One step (red, blue → green vs. white vs. light) is the teaching frame, but run it for 10–15 steps and show three colored traces fanning out from the same seed. red, blue, green, yellow... vs. red, blue, white, stars, stripes, eagle... makes "selection pressure" visceral in a way one word doesn't.

3. Vary the evaluator type, not just the rubric. Use a rule/regex evaluator, an embedding-similarity evaluator, and an LLM-as-judge for the same concept, and display cost/latency/score alongside each. That's the actual engineering-discipline content — when a $0 regex is sufficient vs. when you pay for a judge — and it's blog-post material beyond a toy.

4. Show eval disagreement. "White" scores high on Americana and moderate on colors; "light" scores on science and physics-of-color. A candidate column where the same word gets divergent scores across evaluators is more honest than clean one-eval-one-answer mappings.

5. The auto-tuning loop will reward-hack, and that's your best feature. With a scalar objective and a mutable prompt, the optimizer will converge on something like "always output green" — eval satisfied, intent destroyed. Don't fight it; instrument it. A visible Goodhart moment ("watch the optimizer game the eval") is the most memorable thing this app could show, and it maps directly to the agent-verification conversation you're already in.

6. Practical build notes. Anthropic's API doesn't expose logprobs (~90% confident that's still true), so generate candidates by asking for JSON of 5 next-word options, then score each with the evaluator(s). Haiku keeps it near-free. This fits in a single claude.ai artifact if you want a zero-infra demo, or a small Railway app if you want it public alongside the blog post.

One pushback on Codex's framing: "the system experiments with prompt wording until the model produces those continuations more reliably" undersells the failure mode in #5. If the app only shows auto-tuning working, it teaches the wrong lesson. Show it working and degenerating.

Want me to build a first version of the selection-loop visualization as an artifact?

## Fable 5 High

So yes: given this SPA app build out this demonstration of the selection pressure concept 

Use CEREBRAS_API_KEY  in .env for Gemma4 (one of the best free/cheap open weight reasoning models)
https://inference-docs.cerebras.ai/models/gemma-4-31b

---
Cerebras deprecated Gemma4, this frontend shouldn't care about the details supplied by the monorepo platform.

Implement the new shared Cerebras contract: Requests no longer include a model field, the backend injects CEREBRAS_MODEL or its default.

