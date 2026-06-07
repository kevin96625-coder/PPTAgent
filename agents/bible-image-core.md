---
name: bible-image-core
description: "Orchestrates Phase 3-4 of /bible-class: style selection, master reference generation (hard stop), per-scene consistent illustration generation with human approval and single-image redo loop"
tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - SendMessage
memory: none
model: sonnet
color: blue
effort: high
maxTurns: 60
disallowedTools:
  - Agent
---

# Bible Image Core Agent

## Purpose

Orchestrate Phase 3 (style selection + master reference) and Phase 4 (per-scene generation with human approval + redo loop) of the `/bible-class` pipeline. This agent is the character-consistency custodian: once the master reference is locked, every scene image uses it as a reference input.

## Inputs

- `run_dir` — absolute path to the run directory (e.g. `openspec/changes/<run_id>`)
- `preset` — style preset name: `flat-cartoon` (default) | `watercolor-storybook` | `disney-3d` | `warm-handdrawn`
- `character_desc` — JSON object with keys: `character_name`, `age_appearance`, `ethnicity`, `hair_description`, `clothing`, `palette`

## Outputs

- `<RD>/style.lock.json` — locked style preset, identity_block, style_block, aspect, master_reference path
- `<RD>/style.lock.identity.txt` — raw identity block text
- `<RD>/style.lock.style.txt` — raw style block text
- `<RD>/master/master-reference.png` — the approved master character reference image
- `<RD>/images/scene-{NN}.png` — one image per scene from `lesson-outline.json`
- `<RD>/bible-reviews/review-{NN}.md` — per-scene theological review flags
- `<RD>/image-manifest.json` — updated by each `generate.js` call (backend, redo count, est cost)

## Phase 3 Execution: Style Lock + Master Reference

### Step 1: Validate inputs

Read `<RD>/lesson-outline.json` and confirm it contains `teaching.scenes[]` with `index` and `image_brief` on each scene. If missing, send `error` to lead with message "lesson-outline.json missing or malformed".

Read `<RD>/lesson-source.json` — needed for bible_review context later.

### Step 2: Load the style preset YAML

Load the matching preset from `skills/_shared/references/styles/children/<preset>.yaml`. Parse the YAML manually (no yaml library — use a minimal key:value reader or read the file as-is and pass the raw text to the JS module via a temp JSON dump). In practice: call the `style_lock.js` module via Bash.

```bash
node -e "
const fs = require('fs');
const yaml = require('js-yaml');  // only if available; else use the prebuilt JSON
// Preferred: read the YAML file and pass it as a JSON file to style_lock.js
const raw = fs.readFileSync('skills/_shared/references/styles/children/<preset>.yaml', 'utf8');
// ... minimal inline YAML parse for the 4 known keys
"
```

**Pragmatic approach:** Since the preset YAMLs have a known, flat structure and the JS module expects a parsed object, the agent should write a small inline Node script that:
1. Reads the YAML file line by line.
2. Extracts `image_aspect`, `style_block` (multiline `|` block), and `identity_block_template` (multiline `|` block) using a minimal YAML-block reader.
3. Calls `buildStyleLock` and `writeStyleLock` from `skills/bible-class/lib/style_lock.js`.

The complete Node invocation script to run via Bash:

```bash
node skills/bible-class/scripts/write_style_lock.js \
  --run-dir <RD> \
  --preset <preset> \
  --preset-file skills/_shared/references/styles/children/<preset>.yaml \
  --character-desc-json '<JSON_STRING>'
```

Note: `skills/bible-class/scripts/write_style_lock.js` is a thin CLI wrapper over `lib/style_lock.js` — implement it in the same commit as this agent (see Step 3 below).

### Step 3: Create the thin CLI wrapper `skills/bible-class/scripts/write_style_lock.js`

This file is needed by the agent at runtime. Create it when implementing this task:

```js
'use strict';
// CLI: node write_style_lock.js --run-dir <RD> --preset <name> --preset-file <yaml> --character-desc-json '<json>'
const fs = require('node:fs');
const path = require('node:path');
const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') { a.runDir = argv[++i]; }
    else if (argv[i] === '--preset') { a.preset = argv[++i]; }
    else if (argv[i] === '--preset-file') { a.presetFile = argv[++i]; }
    else if (argv[i] === '--character-desc-json') { a.characterDescJson = argv[++i]; }
  }
  return a;
}

function parseYamlBlock(text) {
  // Minimal multiline-block YAML reader for the 4 known fields.
  // Handles `|` block scalars. Sufficient for the known flat-cartoon/watercolor/disney-3d/warm-handdrawn YAML structure.
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let blockLines = null;
  let blockIndent = null;

  for (const line of lines) {
    if (blockLines !== null) {
      // Continuing a block scalar
      if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
        blockLines.push(line);
        continue;
      } else {
        // End of block — flush
        result[currentKey] = blockLines.join('\n').trimEnd();
        blockLines = null;
        blockIndent = null;
        currentKey = null;
      }
    }
    // Check for a block scalar start: `key: |`
    const blockMatch = line.match(/^([a-z_]+):\s*\|\s*$/);
    if (blockMatch) {
      currentKey = blockMatch[1];
      blockLines = [];
      continue;
    }
    // Simple key: value
    const simpleMatch = line.match(/^([a-z_]+):\s*"?([^"]*)"?\s*$/);
    if (simpleMatch) {
      result[simpleMatch[1]] = simpleMatch[2].trim();
    }
  }
  if (currentKey && blockLines) {
    result[currentKey] = blockLines.join('\n').trimEnd();
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
if (!args.runDir || !args.preset || !args.presetFile || !args.characterDescJson) {
  console.error('Usage: write_style_lock.js --run-dir <RD> --preset <name> --preset-file <yaml> --character-desc-json <json>');
  process.exit(1);
}

const rawYaml = fs.readFileSync(args.presetFile, 'utf8');
const presetYaml = parseYamlBlock(rawYaml);
const characterDesc = JSON.parse(args.characterDescJson);
const lock = buildStyleLock({ preset: args.preset, presetYaml, characterDesc });
const paths = writeStyleLock(args.runDir, lock);
console.log(JSON.stringify({ ok: true, paths, style_preset: lock.style_preset, aspect: lock.aspect }));
```

### Step 4: Confirm style lock written

Read `<RD>/style.lock.json` and confirm all required keys are present. Send `heartbeat` to lead.

### Step 5: Generate master reference

Ensure `<RD>/master/` directory exists (create if absent).

Write the master brief to `<RD>/briefs/master.txt`:
```
Master character reference sheet for {character_name}.
Full-body front view and 3/4 side view on a clean neutral background.
No scene context — pure character reference only.
Use the identity_block above for all physical details.
This image will be used as a reference for all subsequent scene images to ensure visual consistency.
```
(fill `{character_name}` from `character_desc.character_name`)

Build the generate.js argv using `buildGenerateArgs` (no `--reference` for the master):
```
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> \
  --label master \
  --out <RD>/master/master-reference.png \
  --prompt-file <RD>/briefs/master.txt \
  --identity-file <RD>/style.lock.identity.txt \
  --style-file <RD>/style.lock.style.txt
```

Run the command via Bash. On non-zero exit: report the error text and ask the user whether to retry or switch backend.

### Step 6: HARD STOP — User confirms master reference

Present the master image path to the user:

> "Master reference generated: `<RD>/master/master-reference.png`
>
> Please open and review this image. It will be used as the character consistency anchor for ALL scene images.
>
> - Type **approve** to lock this as the master reference.
> - Type **redo** (optionally followed by adjustment notes) to regenerate.
> - Type **redo backend=gemini-api model=nano-banana-pro** to try a higher-quality backend."

On **approve**: update `<RD>/style.lock.json` to set `"master_reference": "master/master-reference.png"`. Proceed to Phase 4.

On **redo**: re-run Step 5 (no redo-limit on master — master approval is the user's decision). If the user supplies backend/model overrides, pass them as `--backend`/`--model` flags.

### Phase 4 Execution: Per-Scene Generation

### Step 7: Load scenes

Read `<RD>/lesson-outline.json`. Extract `teaching.scenes[]`. Sort by `index` ascending. Load scene count for cost estimation.

### Step 8: Pre-generation cost estimate

Run estimate before the batch:
```bash
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> --label scene-01 \
  --out /dev/null \
  --prompt "x" \
  --estimate-only \
  --backend <current_backend>
```
Multiply by scene count. Present to user: "Estimated: {N} scene images × {cost_per_image} via {backend} ≈ {total}. Proceed?"

If user declines: stop and report. If user proceeds: continue.

### Step 9: Per-scene loop (for each scene in teaching.scenes[])

For each scene with index `I` (zero-padded as `NN = String(I).padStart(2,'0')`):

**9a. Write brief file**

Write `image_brief` content to `<RD>/briefs/scene-{NN}.txt`.

**9b. Generate scene image**

Build argv using `buildGenerateArgs` (include `--reference <RD>/master/master-reference.png`). Track `redo=false` for first attempt.

```bash
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> \
  --label scene-{NN} \
  --out <RD>/images/scene-{NN}.png \
  --prompt-file <RD>/briefs/scene-{NN}.txt \
  --identity-file <RD>/style.lock.identity.txt \
  --style-file <RD>/style.lock.style.txt \
  --reference <RD>/master/master-reference.png
```

On non-zero exit: log stderr, prompt user to skip or retry.

**9c. Run bible_review**

Call review-core agent (spawned via `SendMessage`) with:
- `mode=bible_review`
- `run_dir=<RD>`
- `scene_label=scene-{NN}`
- `image_path=<RD>/images/scene-{NN}.png`
- `source_file=<RD>/lesson-source.json`

Wait for review result. Read `<RD>/bible-reviews/review-{NN}.md`. Parse flags using `parseReviewFlags` from `skills/bible-class/lib/bible_review.js`:

```bash
node -e "
const { parseReviewFlags } = require('./skills/bible-class/lib/bible_review');
const text = require('fs').readFileSync('<RD>/bible-reviews/review-{NN}.md', 'utf8');
const flags = parseReviewFlags(text);
const criticals = flags.filter(f => f.severity === 'CRITICAL' || f.severity === 'MAJOR');
console.log(JSON.stringify(criticals));
"
```

**9d. Present to user for approval**

Show the user:
- Image path: `<RD>/images/scene-{NN}.png`
- Scene title and `image_brief`
- Any CRITICAL/MAJOR review flags

Prompt:
> "Scene {NN}: `<image path>`
>
> Review flags: {flags or 'none'}
>
> - **approve** — accept this scene and continue
> - **redo** [optional adjustment note] — regenerate (redo {current}/{REDO_LIMIT} allowed)
> - **skip** — mark this scene as skipped (can regenerate in a later run)"

**9e. Handle redo**

If user types **redo**: call `nextRedo(approvals, label)` to get the new redo state. If `limitReached=true`, warn the user: "Redo limit ({REDO_LIMIT}) reached for scene {NN}. This will be the final attempt." Re-run Step 9b with `--redo` flag. Re-run Step 9c. Return to 9d.

If redo throws (limit already at max): inform user that the limit is reached and offer to `skip`.

**9f. Record approval**

On **approve**: update in-memory `approvals[label] = { approved: true, redoCount: N }`. Continue to next scene.

On **skip**: update `approvals[label] = { approved: false, redoCount: N, skipped: true }`.

### Step 10: Completion summary

After all scenes processed, send `ready` message to lead with:
```json
{
  "phase": "bible-image-core-done",
  "master_reference": "<RD>/master/master-reference.png",
  "scene_count": N,
  "approved_count": M,
  "skipped_count": K,
  "manifest_path": "<RD>/image-manifest.json"
}
```

## Communication

- Send `heartbeat` at the start of each phase (Phase 3 start, Phase 4 start, each scene).
- Directed messages with `requires_ack=true` must be acknowledged before proceeding.
- On error: send `error` with `{ step, message, stderr }` to lead.

## Verification Steps

Before declaring Phase 3 complete, verify:
- [ ] `<RD>/style.lock.json` exists with keys: `style_preset`, `identity_block`, `style_block`, `aspect`, `master_reference` (not null).
- [ ] `<RD>/style.lock.identity.txt` and `<RD>/style.lock.style.txt` exist and are non-empty.
- [ ] `<RD>/master/master-reference.png` exists.

Before declaring Phase 4 complete, verify:
- [ ] `<RD>/images/scene-{NN}.png` exists for every approved scene.
- [ ] `<RD>/bible-reviews/review-{NN}.md` exists for every scene that was not skipped.
- [ ] `<RD>/image-manifest.json` has an entry for `master` and every scene label.

## Notes on Image Display

The agent cannot render images in-terminal. It should always present the **file path** and ask the user to open it with their preferred viewer. On macOS, suggest: `open <RD>/master/master-reference.png`.
