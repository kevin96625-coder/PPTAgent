---
name: image-gen
description: Generate AI images with character-consistency for slide decks. Subscription-first model routing (2026) — gpt-image-2.6-flare / gpt-image-2.6-sunburst run on the local codex CLI's built-in image tool (ChatGPT subscription, zero metered cost), gemini-3.1-flash-image runs on the local agy (Antigravity) CLI's built-in image tool (Google subscription, zero metered cost). All three cover text-to-image, image-to-image and image editing. Metered HTTP backends (openai-fetch / gemini-fetch) remain available when pinned explicitly. Use when a slide needs a generated illustration, or a multi-scene series must keep one character visually consistent.
---

# image-gen

## When to use
- Generating a master character reference, then consistent per-scene illustrations.
- Any single slide illustration.
- Editing an existing image (pass `--reference` and describe the change).

## Environment
Run `node check_env.js` first. `codex-cli` requires the official Codex CLI authenticated via "Sign in with ChatGPT"; `agy-cli` requires the Antigravity `agy` CLI authenticated with a Google account. Do NOT set `OPENAI_API_KEY` in the environment when using `codex-cli` — it would switch Codex to billed API pricing.

## Selectable image models (2026-11, subscription-first)
| Model id | CLI | Backend | Billing | Flows |
|----------|-----|---------|---------|-------|
| `gpt-image-2.6-flare` | codex | `codex-cli` | ChatGPT sub, $0 metered | t2i / i2i / edit |
| `gpt-image-2.6-sunburst` | codex | `codex-cli` | ChatGPT sub, $0 metered | t2i / i2i / edit |
| `gemini-3.1-flash-image` | agy | `agy-cli` | Google sub, $0 metered | t2i / i2i / edit |
| `gpt-image-2` (legacy) | codex | `codex-cli` | ChatGPT sub, $0 metered | t2i / i2i / edit |

Pass `--model <id>` and generate.js routes to the right CLI automatically — no
`--backend` pin needed. The CLIs' built-in image tools pick the current
server-side model generation themselves (the model id is the requested intent,
recorded in image-manifest.json). References: codex attaches them via `--image`
argv; agy embeds `@file` paths (absolute paths verified) in the instruction.
Gemini models never silently fall back to a GPT backend.

## Generate one image
```
node scripts/generate.js \
  --run-dir <RUN_DIR> --label scene-03 --out <RUN_DIR>/images/scene-03.png \
  --model gpt-image-2.6-flare \
  --prompt-file <RUN_DIR>/briefs/scene-03.txt \
  --identity-file <RUN_DIR>/style.lock.identity.txt \
  --style-file <RUN_DIR>/style.lock.style.txt \
  --reference <RUN_DIR>/master/master-reference.png
```
Omit `--reference` for pure text-to-image; repeat/comma-separate for multi-character.

## Estimate cost/quota before a batch
```
node scripts/generate.js ... --estimate-only
```

## Backends
- `codex-cli` (GPT default): ChatGPT subscription, $0 metered; instruction-driven built-in image tool; `--image` references + character consistency. Quota note: image turns drain Codex usage ~3-5x faster than text.
- `agy-cli` (Gemini default): Google/Antigravity subscription, $0 metered; instruction-driven built-in image tool; `@file` reference paths inside the prompt (absolute OK). Verifies the output file was actually written.
- `openai-fetch`: metered relay `/v1/images/generations` (t2i) and `/v1/images/edits` (i2i/edit), needs `OPENAI_API_KEY` + `OPENAI_BASE_URL` in env or `.env` (skill root or `scripts/`). Explicit pin only; falls back to codex-cli on failure.
- `gemini-fetch`: metered direct generativelanguage REST `generateContent` (`inline_data` refs), needs `GEMINI_API_KEY` (free-tier AI Studio key works). Explicit pin only.
- `gemini-api` / `openai-api`: legacy wrapper-CLI adapters (require `image-gen-gemini` / `image-gen-openai` binaries).

## Outputs
- The image at `--out`.
- An atomic `<RUN_DIR>/image-manifest.json` entry (backend, model, seed, redo count, est cost, totals).
