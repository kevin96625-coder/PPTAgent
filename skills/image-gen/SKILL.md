---
name: image-gen
description: Generate AI images with character-consistency for slide decks. Default backend drives the Codex CLI's built-in gpt-image-2 on your ChatGPT subscription (no API key, no per-image billing); metered Gemini (Nano Banana) / OpenAI fallbacks available. Use when a slide needs a generated illustration, or a multi-scene series must keep one character visually consistent.
---

# image-gen

## When to use
- Generating a master character reference, then consistent per-scene illustrations.
- Any single slide illustration.

## Environment
Run `node check_env.js` first. The default `codex-cli` backend requires the official Codex CLI authenticated via "Sign in with ChatGPT". Do NOT set `OPENAI_API_KEY` in the environment when using `codex-cli` — it would switch Codex to billed API pricing.

## Generate one image (default: subscription, zero metered cost)
```
node scripts/generate.js \
  --run-dir <RUN_DIR> --label scene-03 --out <RUN_DIR>/images/scene-03.png \
  --prompt-file <RUN_DIR>/briefs/scene-03.txt \
  --identity-file <RUN_DIR>/style.lock.identity.txt \
  --style-file <RUN_DIR>/style.lock.style.txt \
  --reference <RUN_DIR>/master/master-reference.png
```

## Estimate cost/quota before a batch
```
node scripts/generate.js ... --estimate-only
```

## Backends
- `codex-cli` (default): subscription, $0 metered, supports reference images + character consistency. Quota note: image turns drain Codex usage ~3-5x faster than text.
- `gemini-api`: metered Nano Banana (`--model nano-banana | nano-banana-2 | nano-banana-pro`), needs `GEMINI_API_KEY`.
- `openai-api`: metered gpt-image-2, needs `OPENAI_API_KEY`.

## Outputs
- The image at `--out`.
- An atomic `<RUN_DIR>/image-manifest.json` entry (backend, seed, redo count, est cost, totals).
