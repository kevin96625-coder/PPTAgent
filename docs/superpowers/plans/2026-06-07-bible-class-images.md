# Bible Class Style + Scene Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the `/bible-class` Phases 3–4 subsystem: 4 locked child-style YAML presets, a Node `bible-class` skill library that writes `style.lock.json` and assembles the exact `generate.js` argv, a master-reference hard-stop + per-scene generation orchestrator agent (`bible-image-core.md`), and a `bible_review` mode extension to `review-core.md`.

**This is Plan 3 of 4.**  
Depends on:
- **Plan 1** (`2026-06-06-image-gen-layer.md`) — `skills/image-gen/scripts/generate.js` CLI contract (flags, manifest, `--redo`).
- **Plan 2** (lesson intake + outline) — `lesson-outline.json` (contains `teaching.scenes[]` each with `index`, `image_brief`) and `lesson-source.json`.

Plan 4 (PPTX/HTML assembly) depends on the `style.lock.json` schema and scene image paths defined here.

**Architecture:** Four YAML presets define a locked `identity_block_template`, `style_block`, and `image_aspect`. A small set of pure Node (CommonJS) library modules in `skills/bible-class/lib/` converts a chosen preset into a `style.lock.json` + two plaintext sidecar files, builds the exact `generate.js` argv arrays, tracks per-label redo state, and parses structured bible-review flag output. Two markdown agent files (`bible-image-core.md`, extension to `review-core.md`) orchestrate the human-in-the-loop generation loop.

**Tech Stack:** Node.js ≥18 (CommonJS), built-in `node:test` + `node:assert`. All JS modules are zero-dependency pure-logic. Mirrors the `image-gen` skill conventions (CommonJS, no build step, `node --test` runs directly).

**Branch:** `feature/bible-class-images`

**Plan-wide conventions:**
- Run all JS tests from the skill dir: `cd skills/bible-class`
- Commit after every task; each commit body ends with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- No TS, no build step — pure CommonJS for testability without toolchain.
- All paths in examples are absolute or expressed as `<RD>` = `openspec/changes/<run_id>`.

---

## Shared Contracts (consumed by Plan 4 — do not change after merging Plan 3)

### Inputs from Plan 2
- `<RD>/lesson-outline.json` — must contain `teaching.scenes[]` where each element has `index` (integer, 1-based) and `image_brief` (string).
- `<RD>/lesson-source.json` — bible source facts used by bible_review.

### `style.lock.json` schema
```json
{
  "style_preset": "flat-cartoon",
  "identity_block": "<multi-line string describing main character>",
  "style_block": "<multi-line string describing art style>",
  "aspect": "4:3",
  "master_reference": "master/master-reference.png"
}
```

### Sidecar plaintext files (consumed by `generate.js --identity-file`/`--style-file`)
- `<RD>/style.lock.identity.txt` — the `identity_block` value as raw text.
- `<RD>/style.lock.style.txt` — the `style_block` value as raw text.

### `generate.js` CLI call (from Plan 1 — match exactly)
```
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> \
  --label <scene-NN|master> \
  --out <RD>/images/<scene-NN>.png \
  --prompt-file <brief-file> \
  --identity-file <RD>/style.lock.identity.txt \
  --style-file <RD>/style.lock.style.txt \
  [--reference <RD>/master/master-reference.png] \
  [--redo]
```
Scene images → `<RD>/images/scene-{NN}.png`  
Master → `<RD>/master/master-reference.png`  
Reviews → `<RD>/bible-reviews/review-{NN}.md`

---

## File Structure

```
skills/_shared/references/styles/children/
├── flat-cartoon.yaml           # default — Task 1
├── watercolor-storybook.yaml   # Task 1
├── pixar-3d.yaml               # Task 1
└── warm-handdrawn.yaml         # Task 1

skills/bible-class/
├── package.json                # Task 2
└── lib/
    ├── style_lock.js           # Task 3
    ├── scene_plan.js           # Task 4
    ├── redo_state.js           # Task 5
    └── bible_review.js         # Task 6

skills/bible-class/test/
├── smoke.test.js               # Task 2
├── style_lock.test.js          # Task 3
├── scene_plan.test.js          # Task 4
├── redo_state.test.js          # Task 5
└── bible_review.test.js        # Task 6

agents/bible-image-core.md      # Task 7 (new agent)
agents/review-core.md           # Task 8 (extend with bible_review mode)
```

---

## Task 1: Four child-style YAML presets

**Files:**
- Create: `skills/_shared/references/styles/children/flat-cartoon.yaml`
- Create: `skills/_shared/references/styles/children/watercolor-storybook.yaml`
- Create: `skills/_shared/references/styles/children/pixar-3d.yaml`
- Create: `skills/_shared/references/styles/children/warm-handdrawn.yaml`

These are data files, not JS — no failing test step. Verification is done in Task 3 where `style_lock.js` loads them.

- [ ] **Step 1: Write flat-cartoon.yaml (default)**

Create `skills/_shared/references/styles/children/flat-cartoon.yaml`:

```yaml
name: Flat Cartoon
description: "Flat rounded cartoon, inspired by The Beginner's Bible. Bright cheerful colors, bold outlines, exaggerated friendly expressions. Best default for 3-5 year-olds — theologically easiest to keep restrained."
default: true

image_aspect: "4:3"

identity_block_template: |
  Character: {character_name}
  Age appearance: {age_appearance}
  Ethnicity/region: {ethnicity}
  Hair: {hair_description}
  Clothing: {clothing}
  Color palette for this character: {palette}
  Expression default: warm gentle smile
  Art style lock: flat rounded cartoon, bold black outlines, no photorealism, no gradients on faces
  This character must look IDENTICAL across all scenes — same hair, same clothing colors, same face proportions.

style_block: |
  Art style: flat rounded 2D cartoon illustration
  Line work: bold black outlines, uniform stroke weight ~3px
  Colors: bright saturated palette, flat fills, minimal shading, no photorealistic lighting
  Faces: large expressive eyes, simple nose, warm smile — friendly, never scary
  Background: simple flat-color or minimal gradient, single focal element
  Composition: centered subject, ample negative space, no clutter
  Lighting: even ambient light, no dramatic shadows
  Mood: joyful, safe, age-appropriate for 3-5 year-olds
  Forbidden: photorealism, dark shadows, horror elements, modern objects, anachronistic items
  Period setting: 1st century Near East — robes, sandals, oil lamps, desert/lake landscapes

layout_tokens:
  font_family: "'Nunito', 'Comic Neue', sans-serif"
  heading_size: 48
  body_size: 32
  accent_color: "#F5A623"
  bg_color: "#FFF8E7"
  card_radius: 20
```

- [ ] **Step 2: Write watercolor-storybook.yaml**

Create `skills/_shared/references/styles/children/watercolor-storybook.yaml`:

```yaml
name: Watercolor Storybook
description: "Soft warm watercolor illustration, gentle washes of color with loose pencil outlines. Quiet narrative mood — suits reflective or tender bible scenes."
default: false

image_aspect: "4:3"

identity_block_template: |
  Character: {character_name}
  Age appearance: {age_appearance}
  Ethnicity/region: {ethnicity}
  Hair: {hair_description}
  Clothing: {clothing}
  Color palette for this character: {palette}
  Expression default: serene gentle smile
  Art style lock: watercolor storybook, soft pencil outlines, no photorealism, no bold black outlines
  This character must look IDENTICAL across all scenes — same hair, same clothing colors, same face proportions.

style_block: |
  Art style: soft watercolor picture-book illustration
  Line work: loose pencil or ink sketch underlines with watercolor washes on top
  Colors: muted warm palette — cream, dusty rose, sky blue, sage green, warm ochre
  Shading: gentle wet-on-wet washes, soft edges, no harsh shadows
  Faces: rounded soft features, half-closed warm eyes, tender expression
  Background: loose watercolor wash, impressionistic landscape details
  Composition: storybook page framing, gentle vignette, main subject in mid-ground
  Lighting: soft diffused daylight, golden hour warmth
  Mood: peaceful, tender, contemplative — safe for 3-5 year-olds
  Forbidden: photorealism, harsh outlines, dark horror elements, modern objects, anachronistic items
  Period setting: 1st century Near East — robes, sandals, oil lamps, desert/lake/garden landscapes

layout_tokens:
  font_family: "'Patrick Hand', 'Kalam', cursive"
  heading_size: 44
  body_size: 30
  accent_color: "#D4856A"
  bg_color: "#FDF6EE"
  card_radius: 16
```

- [ ] **Step 3: Write pixar-3d.yaml**

Create `skills/_shared/references/styles/children/pixar-3d.yaml`:

```yaml
name: Pixar 3D
description: "Friendly Pixar/Disney 3D animation aesthetic — subsurface skin, soft rim lighting, appealing character design. High visual impact; requires careful prompt discipline to avoid losing theological restraint."
default: false

image_aspect: "4:3"

identity_block_template: |
  Character: {character_name}
  Age appearance: {age_appearance}
  Ethnicity/region: {ethnicity}
  Hair: {hair_description}
  Clothing: {clothing}
  Color palette for this character: {palette}
  Expression default: kind warm smile, large appealing eyes
  Art style lock: Pixar-style 3D CG render, subsurface scattering skin, appealing proportions, no photorealism grittiness
  This character must look IDENTICAL across all scenes — same hair color/style, same clothing, same face proportions.

style_block: |
  Art style: Pixar/Disney-style 3D CG animation render
  Character design: appealing proportions, large expressive eyes, smooth skin with subsurface scattering
  Colors: vibrant yet harmonious palette, warm color temperature overall
  Lighting: soft three-point studio lighting, gentle rim light, warm fill — never harsh or horror-adjacent
  Background: stylized 3D environment, depth-of-field blur on background, uncluttered
  Composition: medium shot or medium-close, subject centered, 3/4 angle preferred
  Mood: uplifting, warm, child-friendly — safe for 3-5 year-olds
  Render quality: high-quality CG still, clean antialiasing
  Forbidden: photorealism grit, dark horror lighting, modern objects, anachronistic items, uncanny valley faces
  Period setting: stylized 1st century Near East — robes, sandals, oil lamps, stylized desert/lake/village

layout_tokens:
  font_family: "'Baloo 2', 'Fredoka One', sans-serif"
  heading_size: 46
  body_size: 31
  accent_color: "#4A90D9"
  bg_color: "#EEF6FF"
  card_radius: 18
```

- [ ] **Step 4: Write warm-handdrawn.yaml**

Create `skills/_shared/references/styles/children/warm-handdrawn.yaml`:

```yaml
name: Warm Handdrawn
description: "Crayon and thick-marker hand-drawn storybook style — wobbly lines, textured fills, energetic and playful. Best for active or joyful scenes."
default: false

image_aspect: "4:3"

identity_block_template: |
  Character: {character_name}
  Age appearance: {age_appearance}
  Ethnicity/region: {ethnicity}
  Hair: {hair_description}
  Clothing: {clothing}
  Color palette for this character: {palette}
  Expression default: big joyful smile
  Art style lock: hand-drawn crayon marker style, wobbly outlines, no photorealism, no flat digital vector fills
  This character must look IDENTICAL across all scenes — same hair, same clothing colors, same face proportions.

style_block: |
  Art style: hand-drawn children's book illustration with crayon and thick marker texture
  Line work: chunky wobbly outlines as if drawn by a careful adult with a marker, slightly imperfect
  Colors: warm saturated crayon palette — red, yellow, blue, green, orange — with visible texture grain
  Shading: cross-hatch or layered crayon strokes, no photorealistic gradients
  Faces: simple round features, big dot eyes, wide mouth smile — instantly friendly
  Background: hand-drawn landscape or interior, loose detail, energetic marks
  Composition: slightly tilted or informal framing, lively and playful
  Lighting: implied by warm color temperature, no realistic shadows
  Mood: joyful, active, playful — safe and engaging for 3-5 year-olds
  Forbidden: photorealism, digital-clean lines, dark shadows, modern objects, anachronistic items
  Period setting: 1st century Near East — robes, sandals, oil lamps, desert/lake/village drawn in hand-drawn style

layout_tokens:
  font_family: "'Schoolbell', 'Caveat', cursive"
  heading_size: 46
  body_size: 31
  accent_color: "#E8534A"
  bg_color: "#FFFAE8"
  card_radius: 14
```

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git checkout -b feature/bible-class-images
git add skills/_shared/references/styles/children/
git commit -m "$(cat <<'EOF'
feat(bible-class): add 4 child style preset YAMLs with identity + style blocks

Each preset contains identity_block_template, style_block, image_aspect, and
layout_tokens for the storybook HTML renderer (Plan 4). flat-cartoon is default.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Ensure `skills/bible-class` package exists (SHARED with Plan 2 — idempotent)

> **Consistency note:** The `skills/bible-class/` skill (package.json + `lib/` + `test/`) is FIRST scaffolded by **Plan 2** (its Task 1). When Plan 3 runs after Plan 2 (the normal sequence), this task is a **no-op verification** — the package already exists, so do NOT re-create or re-commit it. Only create it if you are running Plan 3 standalone before Plan 2.

**Files:**
- Verify exists (created by Plan 2): `skills/bible-class/package.json`, `skills/bible-class/lib/`, `skills/bible-class/test/`

- [ ] **Step 1: Check whether the skill was already scaffolded by Plan 2**

Run: `ls skills/bible-class/package.json skills/bible-class/lib 2>/dev/null && echo EXISTS || echo MISSING`

- [ ] **Step 2: If EXISTS — confirm and skip to Task 3**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/`
Expected: existing Plan 2 tests PASS. Do not create or commit anything. Proceed to Task 3 (its modules are NEW files added to the existing skill).

- [ ] **Step 3: ONLY if MISSING (standalone run) — scaffold the skill**

Create `skills/bible-class/package.json`:

```json
{
  "name": "bible-class",
  "version": "0.1.0",
  "description": "Bible-class skill modules: lesson schema + craft writer (Plan 2), style-lock writer, scene plan builder, redo state tracker, bible-review parser (Plan 3).",
  "type": "commonjs",
  "private": true,
  "scripts": {
    "test": "node --test"
  },
  "license": "ISC"
}
```

Create `skills/bible-class/lib/.gitkeep` (empty file, ensures the directory exists).

Then commit:

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/package.json skills/bible-class/lib/.gitkeep
git commit -m "$(cat <<'EOF'
feat(bible-class): scaffold skill package (standalone — normally done in Plan 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `style_lock.js` — build and write the style lock

**Files:**
- Create: `skills/bible-class/lib/style_lock.js`
- Create: `skills/bible-class/test/style_lock.test.js`

**Module interface:**

```
buildStyleLock({preset, presetYaml, characterDesc}) → {style_preset, identity_block, style_block, aspect}
writeStyleLock(runDir, lock) → void   (writes 3 files; returns file paths)
```

`presetYaml` is the parsed YAML object (caller loads it — keeps the module zero-dep).  
`characterDesc` is a plain-English character description (`{character_name}`, `{age_appearance}`, etc. placeholders in `identity_block_template` are filled from a structured `characterDesc` object).

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/style_lock.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildStyleLock, writeStyleLock } = require('../lib/style_lock');

// Minimal preset YAML object mirroring the real flat-cartoon.yaml structure
const FLAT_CARTOON_YAML = {
  name: 'Flat Cartoon',
  image_aspect: '4:3',
  identity_block_template:
    'Character: {character_name}\nHair: {hair_description}\nClothing: {clothing}\nArt style lock: flat rounded cartoon',
  style_block:
    'Art style: flat rounded 2D cartoon illustration\nLine work: bold black outlines',
};

const CHARACTER_DESC = {
  character_name: 'Jesus',
  age_appearance: 'early 30s',
  ethnicity: '1st-century Jewish Near Eastern',
  hair_description: 'brown shoulder-length wavy hair, short beard',
  clothing: 'beige/cream ankle-length robe, brown leather sandals',
  palette: 'warm beige, cream, brown, muted blue',
};

test('buildStyleLock fills identity_block_template placeholders', () => {
  const lock = buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: CHARACTER_DESC,
  });
  assert.strictEqual(lock.style_preset, 'flat-cartoon');
  assert.match(lock.identity_block, /Jesus/);
  assert.match(lock.identity_block, /brown shoulder-length wavy hair/);
  assert.match(lock.identity_block, /flat rounded cartoon/);
  assert.match(lock.style_block, /flat rounded 2D cartoon/);
  assert.strictEqual(lock.aspect, '4:3');
});

test('buildStyleLock leaves no unfilled {placeholder} tokens in identity_block', () => {
  const lock = buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: CHARACTER_DESC,
  });
  assert.doesNotMatch(lock.identity_block, /\{[a-z_]+\}/);
});

test('buildStyleLock throws when presetYaml missing style_block', () => {
  assert.throws(() => buildStyleLock({
    preset: 'x',
    presetYaml: { image_aspect: '4:3', identity_block_template: 'hi' },
    characterDesc: CHARACTER_DESC,
  }), /style_block/);
});

test('buildStyleLock throws when characterDesc missing required keys', () => {
  assert.throws(() => buildStyleLock({
    preset: 'flat-cartoon',
    presetYaml: FLAT_CARTOON_YAML,
    characterDesc: {},
  }), /characterDesc/);
});

test('writeStyleLock creates style.lock.json, style.lock.identity.txt, style.lock.style.txt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  const paths = writeStyleLock(dir, lock);

  const jsonPath = path.join(dir, 'style.lock.json');
  const idPath = path.join(dir, 'style.lock.identity.txt');
  const stylePath = path.join(dir, 'style.lock.style.txt');

  assert.ok(fs.existsSync(jsonPath), 'style.lock.json must exist');
  assert.ok(fs.existsSync(idPath), 'style.lock.identity.txt must exist');
  assert.ok(fs.existsSync(stylePath), 'style.lock.style.txt must exist');

  assert.deepStrictEqual(paths, { jsonPath, idPath, stylePath });
});

test('writeStyleLock style.lock.json contains all required keys with correct values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  writeStyleLock(dir, lock);

  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'style.lock.json'), 'utf8'));
  assert.strictEqual(onDisk.style_preset, 'flat-cartoon');
  assert.ok(typeof onDisk.identity_block === 'string' && onDisk.identity_block.length > 0);
  assert.ok(typeof onDisk.style_block === 'string' && onDisk.style_block.length > 0);
  assert.strictEqual(onDisk.aspect, '4:3');
  // master_reference is not set by writeStyleLock (set later by the agent after master generation)
  assert.ok(!('master_reference' in onDisk) || onDisk.master_reference === null);
});

test('writeStyleLock identity.txt content matches lock.identity_block', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stlock-'));
  const lock = buildStyleLock({ preset: 'flat-cartoon', presetYaml: FLAT_CARTOON_YAML, characterDesc: CHARACTER_DESC });
  writeStyleLock(dir, lock);

  const idTxt = fs.readFileSync(path.join(dir, 'style.lock.identity.txt'), 'utf8');
  assert.strictEqual(idTxt.trim(), lock.identity_block.trim());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/style_lock.test.js`
Expected: FAIL — "Cannot find module '../lib/style_lock'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/style_lock.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Required keys in characterDesc — used to validate input and fill template placeholders.
const REQUIRED_CHAR_KEYS = [
  'character_name',
  'age_appearance',
  'ethnicity',
  'hair_description',
  'clothing',
  'palette',
];

/**
 * Build a style lock object from a preset YAML and a character description.
 *
 * @param {{preset:string, presetYaml:object, characterDesc:object}} opts
 * @returns {{style_preset:string, identity_block:string, style_block:string, aspect:string}}
 */
function buildStyleLock({ preset, presetYaml, characterDesc }) {
  if (!presetYaml || typeof presetYaml.style_block !== 'string') {
    throw new Error('buildStyleLock: presetYaml must contain a style_block string');
  }
  if (!presetYaml.identity_block_template || typeof presetYaml.identity_block_template !== 'string') {
    throw new Error('buildStyleLock: presetYaml must contain an identity_block_template string');
  }
  if (!presetYaml.image_aspect) {
    throw new Error('buildStyleLock: presetYaml must contain image_aspect');
  }

  // Validate characterDesc has the required keys.
  const missing = REQUIRED_CHAR_KEYS.filter((k) => !characterDesc || !characterDesc[k]);
  if (missing.length > 0) {
    throw new Error(`buildStyleLock: characterDesc is missing required keys: ${missing.join(', ')}`);
  }

  // Fill placeholders in the identity_block_template.
  let identity_block = presetYaml.identity_block_template;
  for (const key of REQUIRED_CHAR_KEYS) {
    identity_block = identity_block.replace(new RegExp(`\\{${key}\\}`, 'g'), characterDesc[key]);
  }
  // Also replace any extra keys provided.
  for (const [key, val] of Object.entries(characterDesc)) {
    identity_block = identity_block.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
  }

  return {
    style_preset: String(preset),
    identity_block: identity_block.trim(),
    style_block: presetYaml.style_block.trim(),
    aspect: String(presetYaml.image_aspect),
  };
}

/**
 * Write the style lock to three files in runDir:
 *   style.lock.json         — full lock object (note: master_reference is null until master is generated)
 *   style.lock.identity.txt — raw identity_block text (consumed by generate.js --identity-file)
 *   style.lock.style.txt    — raw style_block text (consumed by generate.js --style-file)
 *
 * @param {string} runDir
 * @param {{style_preset:string, identity_block:string, style_block:string, aspect:string}} lock
 * @returns {{jsonPath:string, idPath:string, stylePath:string}}
 */
function writeStyleLock(runDir, lock) {
  const jsonPath = path.join(runDir, 'style.lock.json');
  const idPath = path.join(runDir, 'style.lock.identity.txt');
  const stylePath = path.join(runDir, 'style.lock.style.txt');

  const jsonContent = {
    style_preset: lock.style_preset,
    identity_block: lock.identity_block,
    style_block: lock.style_block,
    aspect: lock.aspect,
    master_reference: null,  // set by the agent after master image is confirmed
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2));
  fs.writeFileSync(idPath, lock.identity_block + '\n');
  fs.writeFileSync(stylePath, lock.style_block + '\n');

  return { jsonPath, idPath, stylePath };
}

module.exports = { buildStyleLock, writeStyleLock, REQUIRED_CHAR_KEYS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/style_lock.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/style_lock.js skills/bible-class/test/style_lock.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): style_lock — build + write style.lock.json and sidecar txt files

buildStyleLock fills identity_block_template placeholders from characterDesc.
writeStyleLock writes style.lock.json + style.lock.identity.txt + style.lock.style.txt.
master_reference key starts null; agent sets it after master image is confirmed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `scene_plan.js` — build the exact `generate.js` argv

**Files:**
- Create: `skills/bible-class/lib/scene_plan.js`
- Create: `skills/bible-class/test/scene_plan.test.js`

**Module interface:**

```
buildGenerateArgs({runDir, label, outPath, briefFile, identityFile, styleFile, reference, redo}) → string[]
```

Returns the exact `process.argv`-style array to pass to `node skills/image-gen/scripts/generate.js` (the node binary and script path are NOT included — caller prepends them). `reference` is optional: pass it for scene images, omit it for the master.

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/scene_plan.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { buildGenerateArgs } = require('../lib/scene_plan');

const BASE = {
  runDir: '/rd/run1',
  label: 'scene-03',
  outPath: '/rd/run1/images/scene-03.png',
  briefFile: '/rd/run1/briefs/scene-03.txt',
  identityFile: '/rd/run1/style.lock.identity.txt',
  styleFile: '/rd/run1/style.lock.style.txt',
};

test('buildGenerateArgs returns an array of strings with all required flags', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  assert.ok(Array.isArray(args), 'must return an array');
  assert.ok(args.every((a) => typeof a === 'string'), 'all elements must be strings');
});

test('buildGenerateArgs includes --run-dir, --label, --out', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--run-dir \/rd\/run1/);
  assert.match(joined, /--label scene-03/);
  assert.match(joined, /--out \/rd\/run1\/images\/scene-03\.png/);
});

test('buildGenerateArgs includes --prompt-file, --identity-file, --style-file', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--prompt-file \/rd\/run1\/briefs\/scene-03\.txt/);
  assert.match(joined, /--identity-file \/rd\/run1\/style\.lock\.identity\.txt/);
  assert.match(joined, /--style-file \/rd\/run1\/style\.lock\.style\.txt/);
});

test('buildGenerateArgs includes --reference for scene images when reference is provided', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/rd/run1/master/master-reference.png' });
  const joined = args.join(' ');
  assert.match(joined, /--reference \/rd\/run1\/master\/master-reference\.png/);
});

test('buildGenerateArgs OMITS --reference when reference is not provided (master generation)', () => {
  const masterArgs = buildGenerateArgs({
    runDir: '/rd/run1',
    label: 'master',
    outPath: '/rd/run1/master/master-reference.png',
    briefFile: '/rd/run1/briefs/master.txt',
    identityFile: '/rd/run1/style.lock.identity.txt',
    styleFile: '/rd/run1/style.lock.style.txt',
    // no reference
  });
  assert.ok(!masterArgs.includes('--reference'), '--reference must be absent for master generation');
  assert.match(masterArgs.join(' '), /--label master/);
});

test('buildGenerateArgs includes --redo when redo=true', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png', redo: true });
  assert.ok(args.includes('--redo'), '--redo must be present when redo=true');
});

test('buildGenerateArgs OMITS --redo when redo=false or absent', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png', redo: false });
  assert.ok(!args.includes('--redo'), '--redo must be absent when redo=false');

  const args2 = buildGenerateArgs({ ...BASE, reference: '/m.png' });
  assert.ok(!args2.includes('--redo'), '--redo must be absent when redo not specified');
});

test('buildGenerateArgs consecutive flag/value pairs are correctly paired', () => {
  const args = buildGenerateArgs({ ...BASE, reference: '/m.png' });
  // Check that --run-dir is immediately followed by its value
  const rdIdx = args.indexOf('--run-dir');
  assert.ok(rdIdx >= 0, '--run-dir must be in args');
  assert.strictEqual(args[rdIdx + 1], '/rd/run1');

  const labelIdx = args.indexOf('--label');
  assert.ok(labelIdx >= 0, '--label must be in args');
  assert.strictEqual(args[labelIdx + 1], 'scene-03');
});

test('buildGenerateArgs throws when required fields missing', () => {
  assert.throws(() => buildGenerateArgs({ label: 'x', outPath: '/o.png', briefFile: '/b.txt', identityFile: '/i.txt', styleFile: '/s.txt' }), /runDir/);
  assert.throws(() => buildGenerateArgs({ runDir: '/r', outPath: '/o.png', briefFile: '/b.txt', identityFile: '/i.txt', styleFile: '/s.txt' }), /label/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/scene_plan.test.js`
Expected: FAIL — "Cannot find module '../lib/scene_plan'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/scene_plan.js`:

```js
'use strict';

/**
 * Build the exact argv array to pass to `node skills/image-gen/scripts/generate.js`.
 * The node binary and script path are NOT included — prepend them in the caller.
 *
 * Contract (matches Plan 1 generate.js CLI):
 *   --run-dir <RD>
 *   --label <label>
 *   --out <outPath>
 *   --prompt-file <briefFile>
 *   --identity-file <identityFile>
 *   --style-file <styleFile>
 *   [--reference <reference>]   — present for scene images; OMITTED for master
 *   [--redo]                    — present when redo=true
 *
 * @param {{
 *   runDir: string,
 *   label: string,
 *   outPath: string,
 *   briefFile: string,
 *   identityFile: string,
 *   styleFile: string,
 *   reference?: string,
 *   redo?: boolean
 * }} opts
 * @returns {string[]}
 */
function buildGenerateArgs(opts) {
  const { runDir, label, outPath, briefFile, identityFile, styleFile, reference, redo } = opts;

  if (!runDir) throw new Error('buildGenerateArgs: runDir is required');
  if (!label) throw new Error('buildGenerateArgs: label is required');
  if (!outPath) throw new Error('buildGenerateArgs: outPath is required');
  if (!briefFile) throw new Error('buildGenerateArgs: briefFile is required');
  if (!identityFile) throw new Error('buildGenerateArgs: identityFile is required');
  if (!styleFile) throw new Error('buildGenerateArgs: styleFile is required');

  const args = [
    '--run-dir', String(runDir),
    '--label', String(label),
    '--out', String(outPath),
    '--prompt-file', String(briefFile),
    '--identity-file', String(identityFile),
    '--style-file', String(styleFile),
  ];

  // Include --reference only for scene images (omit for master generation).
  if (reference) {
    args.push('--reference', String(reference));
  }

  // Include --redo only when explicitly requested.
  if (redo === true) {
    args.push('--redo');
  }

  return args;
}

module.exports = { buildGenerateArgs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/scene_plan.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/scene_plan.js skills/bible-class/test/scene_plan.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): scene_plan — buildGenerateArgs constructs exact generate.js argv

Includes --reference for scene images, omits it for master generation.
Includes --redo when redo=true, omits otherwise. Matches Plan 1 CLI contract exactly.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `redo_state.js` — pure redo approval tracking

**Files:**
- Create: `skills/bible-class/lib/redo_state.js`
- Create: `skills/bible-class/test/redo_state.test.js`

**Module interface:**

```
nextRedo(approvals, label) → {approved:bool, redoCount:number, limitReached:bool}
```

`approvals` is a plain object map `{[label]: {approved:bool, redoCount:number}}`. `nextRedo` is pure: it returns a new state object without mutating approvals. `REDO_LIMIT` = 3 (default, matching spec §2.10).

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/redo_state.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { nextRedo, REDO_LIMIT } = require('../lib/redo_state');

test('REDO_LIMIT is 3', () => {
  assert.strictEqual(REDO_LIMIT, 3);
});

test('nextRedo returns redoCount=1 for first redo on a fresh label', () => {
  const approvals = {};
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.approved, false);
  assert.strictEqual(result.redoCount, 1);
  assert.strictEqual(result.limitReached, false);
});

test('nextRedo increments redoCount on existing unapproved label', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.redoCount, 2);
  assert.strictEqual(result.limitReached, false);
});

test('nextRedo sets limitReached=true when redoCount would reach REDO_LIMIT', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 2 } };
  const result = nextRedo(approvals, 'scene-01');
  assert.strictEqual(result.redoCount, 3);
  assert.strictEqual(result.limitReached, true);
});

test('nextRedo throws when redo count already at or above limit', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 3 } };
  assert.throws(() => nextRedo(approvals, 'scene-01'), /limit/i);
});

test('nextRedo is pure — does not mutate the approvals object', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const before = JSON.stringify(approvals);
  nextRedo(approvals, 'scene-01');
  assert.strictEqual(JSON.stringify(approvals), before);
});

test('nextRedo throws on already-approved label', () => {
  const approvals = { 'scene-01': { approved: true, redoCount: 0 } };
  assert.throws(() => nextRedo(approvals, 'scene-01'), /approved/i);
});

test('nextRedo handles multiple independent labels without cross-contamination', () => {
  const approvals = { 'scene-01': { approved: false, redoCount: 1 } };
  const r2 = nextRedo(approvals, 'scene-02');
  assert.strictEqual(r2.redoCount, 1);  // scene-02 is fresh
  const r1 = nextRedo(approvals, 'scene-01');
  assert.strictEqual(r1.redoCount, 2);  // scene-01 was at 1
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/redo_state.test.js`
Expected: FAIL — "Cannot find module '../lib/redo_state'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/redo_state.js`:

```js
'use strict';

/**
 * Default per-label redo limit (matches SUNDAY_SCHOOL_DESIGN §2.10).
 * Users may override via the orchestrator's --redo-limit flag, but this is the guard.
 */
const REDO_LIMIT = 3;

/**
 * Pure helper: given the current approvals map and a label that the user wants to redo,
 * return the new state for that label. Does NOT mutate approvals.
 *
 * @param {Object.<string, {approved:boolean, redoCount:number}>} approvals
 *   The current per-label approval/redo state.
 * @param {string} label  The scene label to redo (e.g. "scene-03").
 * @returns {{approved:boolean, redoCount:number, limitReached:boolean}}
 * @throws if the label is already approved, or if the redo count is already at the limit.
 */
function nextRedo(approvals, label) {
  const current = approvals[label] || { approved: false, redoCount: 0 };

  if (current.approved) {
    throw new Error(`nextRedo: label "${label}" is already approved — cannot redo`);
  }
  if (current.redoCount >= REDO_LIMIT) {
    throw new Error(`nextRedo: label "${label}" has reached the redo limit (${REDO_LIMIT})`);
  }

  const newRedoCount = current.redoCount + 1;
  return {
    approved: false,
    redoCount: newRedoCount,
    limitReached: newRedoCount >= REDO_LIMIT,
  };
}

module.exports = { nextRedo, REDO_LIMIT };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/redo_state.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/redo_state.js skills/bible-class/test/redo_state.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): redo_state — pure nextRedo helper with REDO_LIMIT=3 guard

Throws on already-approved labels or when limit is reached.
Pure function — does not mutate caller's approvals map.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `bible_review.js` — review flag parser + checklist constant

**Files:**
- Create: `skills/bible-class/lib/bible_review.js`
- Create: `skills/bible-class/test/bible_review.test.js`

**Module interface:**

```
parseReviewFlags(text) → Array<{severity:string, scene:string, issue:string}>
CHECKLIST → Array<{id:string, label:string, description:string}>
```

`parseReviewFlags` parses a structured review block produced by the `bible_review` agent prompt. The structured block uses one flag per line with the format:  
`[SEVERITY] scene:<label> — <issue description>`  
where `SEVERITY` is one of `CRITICAL`, `MAJOR`, `MINOR`, `OK`.

Lines not matching this format are ignored.

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/bible_review.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { parseReviewFlags, CHECKLIST } = require('../lib/bible_review');

const SAMPLE_REVIEW = `
## Bible Review — Scene 03

[CRITICAL] scene:scene-03 — A wristwatch is visible on Jesus's wrist (anachronism: modern object)
[MAJOR] scene:scene-02 — The cross symbol appears on a robe (anachronism: not used until post-resurrection)
[MINOR] scene:scene-01 — Background includes a building that resembles a modern house
[OK] scene:master — Character appearance is period-appropriate and reverent
Some other narrative text that should be ignored.
`;

test('parseReviewFlags extracts all flagged lines', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags.length, 4);
});

test('parseReviewFlags correctly extracts severity', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags[0].severity, 'CRITICAL');
  assert.strictEqual(flags[1].severity, 'MAJOR');
  assert.strictEqual(flags[2].severity, 'MINOR');
  assert.strictEqual(flags[3].severity, 'OK');
});

test('parseReviewFlags correctly extracts scene label', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.strictEqual(flags[0].scene, 'scene-03');
  assert.strictEqual(flags[1].scene, 'scene-02');
  assert.strictEqual(flags[3].scene, 'master');
});

test('parseReviewFlags correctly extracts issue description', () => {
  const flags = parseReviewFlags(SAMPLE_REVIEW);
  assert.match(flags[0].issue, /wristwatch/);
  assert.match(flags[1].issue, /cross symbol/);
});

test('parseReviewFlags returns empty array on empty input', () => {
  assert.deepStrictEqual(parseReviewFlags(''), []);
  assert.deepStrictEqual(parseReviewFlags(null), []);
  assert.deepStrictEqual(parseReviewFlags(undefined), []);
});

test('parseReviewFlags ignores non-flag lines', () => {
  const flags = parseReviewFlags('This is a paragraph with no flags.\nAnother line.');
  assert.strictEqual(flags.length, 0);
});

test('parseReviewFlags handles severity case-insensitively', () => {
  const flags = parseReviewFlags('[critical] scene:scene-01 — lowercase severity test');
  assert.strictEqual(flags.length, 1);
  assert.strictEqual(flags[0].severity, 'CRITICAL');
});

test('CHECKLIST is an array with 4 required check IDs', () => {
  assert.ok(Array.isArray(CHECKLIST));
  const ids = CHECKLIST.map((c) => c.id);
  assert.ok(ids.includes('anachronism'), 'must include anachronism check');
  assert.ok(ids.includes('faithfulness'), 'must include faithfulness check');
  assert.ok(ids.includes('reverence'), 'must include reverence check');
  assert.ok(ids.includes('period-setting'), 'must include period-setting check');
});

test('each CHECKLIST item has id, label, and description strings', () => {
  for (const item of CHECKLIST) {
    assert.ok(typeof item.id === 'string' && item.id.length > 0, `item.id must be a non-empty string`);
    assert.ok(typeof item.label === 'string' && item.label.length > 0, `item.label must be a non-empty string`);
    assert.ok(typeof item.description === 'string' && item.description.length > 0, `item.description must be a non-empty string`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/bible_review.test.js`
Expected: FAIL — "Cannot find module '../lib/bible_review'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/bible_review.js`:

```js
'use strict';

/**
 * Theological review checklist (SUNDAY_SCHOOL_DESIGN §2.7).
 * Used in the bible_review agent prompt to enumerate what to check.
 * Each item: { id, label, description }.
 */
const CHECKLIST = [
  {
    id: 'anachronism',
    label: 'Anachronism / Modern Objects',
    description:
      'No modern objects (watches, phones, buildings, vehicles, electrical items) visible in the image. ' +
      'All props, clothing, and structures must be consistent with 1st-century Near Eastern life.',
  },
  {
    id: 'faithfulness',
    label: 'Faithfulness to Scripture',
    description:
      'The scene depicted matches the lesson-source.json scripture reference and the image_brief. ' +
      'No extra-biblical events, invented miracles, or theologically loaded additions not present in the source text.',
  },
  {
    id: 'reverence',
    label: 'Reverence and Child-Appropriateness',
    description:
      'The image is reverent, not frightening or disturbing for 3–5 year-olds. ' +
      'No horror elements, violent gore, or imagery that could distress young children. ' +
      'Biblical characters (especially Jesus) are depicted with dignity.',
  },
  {
    id: 'period-setting',
    label: 'Period Setting Accuracy',
    description:
      'Clothing (robes, tunics, sandals), architecture (stone, mud brick, palm trees), ' +
      'and landscape (desert, Sea of Galilee, Jerusalem hills) are consistent with 1st-century Near Eastern context. ' +
      'No European medieval castles, Gothic crosses, or other out-of-period settings.',
  },
];

// Recognized severity levels (uppercase, from the review block format).
const SEVERITIES = new Set(['CRITICAL', 'MAJOR', 'MINOR', 'OK']);

// Flag line pattern: [SEVERITY] scene:<label> — <issue>
// Severity is matched case-insensitively and normalized to uppercase.
// The em-dash (—) or double-hyphen (--) separates scene from issue.
const FLAG_RE = /^\[([A-Za-z]+)\]\s+scene:([\w-]+)\s*[—\-]{1,2}\s*(.+)$/;

/**
 * Parse structured review flag lines from a bible-review text block.
 *
 * Input format (one flag per line):
 *   [SEVERITY] scene:<label> — <issue description>
 *
 * Lines that do not match are silently ignored (narrative prose, blank lines, headers).
 *
 * @param {string|null|undefined} text  Raw review text from the agent.
 * @returns {Array<{severity:string, scene:string, issue:string}>}
 */
function parseReviewFlags(text) {
  if (!text || typeof text !== 'string') return [];

  const flags = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const m = FLAG_RE.exec(line);
    if (!m) continue;

    const severity = m[1].toUpperCase();
    // Accept any severity string — not just the known set — so the parser is forward-compatible.
    // But normalize to uppercase.
    flags.push({
      severity: SEVERITIES.has(severity) ? severity : severity,
      scene: m[2].trim(),
      issue: m[3].trim(),
    });
  }
  return flags;
}

module.exports = { parseReviewFlags, CHECKLIST };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/bible_review.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test`
Expected: PASS — all tests across smoke, style_lock, scene_plan, redo_state, bible_review green.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/bible_review.js skills/bible-class/test/bible_review.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): bible_review — parseReviewFlags + CHECKLIST (anachronism, faithfulness, reverence, period-setting)

parseReviewFlags extracts [SEVERITY] scene:<label> — <issue> lines from review text.
CHECKLIST constant used in agent prompt to enumerate all 4 theological checks.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: New agent `agents/bible-image-core.md`

**Files:**
- Create: `agents/bible-image-core.md`

This is a markdown agent file. Verification is done by inspecting the written file for required sections, not by JS unit tests.

- [ ] **Step 1: Write `agents/bible-image-core.md`**

Create `agents/bible-image-core.md`:

```markdown
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
- `preset` — style preset name: `flat-cartoon` (default) | `watercolor-storybook` | `pixar-3d` | `warm-handdrawn`
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
  // Handles `|` block scalars. Sufficient for the known flat-cartoon/watercolor/pixar/warm-handdrawn YAML structure.
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
```

- [ ] **Step 2: Verify the file is complete**

Verification checklist (inspect the written file):
- [ ] Front-matter block present with name, tools, model.
- [ ] Phase 3 steps 1–6 present, including master brief text and the exact `generate.js` CLI invocation.
- [ ] HARD STOP in Step 6 with approve/redo/redo-with-backend options.
- [ ] `write_style_lock.js` inline implementation present in Step 3.
- [ ] Phase 4 steps 7–10 present, including bible_review call + `parseReviewFlags` inline bash.
- [ ] Redo loop calls `nextRedo` and passes `--redo` to `generate.js`.
- [ ] `style.lock.json` `master_reference` field is set post-approval (Step 6 approve branch).
- [ ] Completion summary sends `ready` with `phase=bible-image-core-done`.
- [ ] Verification Steps section present.

- [ ] **Step 3: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add agents/bible-image-core.md
git commit -m "$(cat <<'EOF'
feat(bible-class): bible-image-core agent — Phase 3+4 orchestration

Phase 3: style YAML → style.lock, master generation, HARD STOP user confirm.
Phase 4: per-scene generate.js + bible_review + human approve/redo loop.
Uses buildGenerateArgs (--reference for scenes, absent for master), nextRedo guard,
and parseReviewFlags for CRITICAL/MAJOR flag display.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Extend `agents/review-core.md` with `mode=bible_review`

**Files:**
- Modify: `agents/review-core.md`

This is a markdown extension. Verification is done by inspecting the written additions, not by JS unit tests.

- [ ] **Step 1: Read current `agents/review-core.md`**

Read the full file to find the correct insertion point (after the existing `## Inputs` section, since `bible_review` is a new mode peer to `review | holistic`).

- [ ] **Step 2: Add `bible_review` mode to the Inputs section**

In `agents/review-core.md`, update the `mode` line in the Inputs section from:

```
- `mode`: `review` | `holistic`
```

to:

```
- `mode`: `review` | `holistic` | `bible_review`
```

- [ ] **Step 3: Add the `bible_review` mode section**

Append the following new top-level section to `agents/review-core.md` (after the existing `## Holistic Mode Execution` section, before `## Communication`):

```markdown
### Bible Review Mode Execution (`mode=bible_review`)

For `mode=bible_review`:

**Additional inputs (required):**
- `scene_label` — the label of the scene to review (e.g. `scene-03` or `master`)
- `image_path` — absolute path to the generated image PNG
- `source_file` — absolute path to `lesson-source.json` (the authoritative scripture source)

**Purpose:** Theological and historical accuracy review of a generated bible-class illustration. This mode ONLY flags problems — it never rewrites doctrine, never alters image prompts autonomously, and never makes theological judgments. All flags are advisory: the human user makes the final decision.

**Execution:**

1. Read `lesson-source.json` to extract: `book`, `chapter`, `verse`, `lesson_title`, `key_points[]`, `target_age`.

2. Read `<run_dir>/lesson-outline.json`. Find the scene entry where `index` matches the numeric part of `scene_label`. Extract `image_brief` and `scene_title`.

3. Load the `CHECKLIST` constant from `skills/bible-class/lib/bible_review.js` via Bash to get the 4 check IDs and their descriptions:
   ```bash
   node -e "const { CHECKLIST } = require('./skills/bible-class/lib/bible_review'); console.log(JSON.stringify(CHECKLIST, null, 2));"
   ```

4. Build a review prompt for Claude (self-review, no Gemini call needed for theological content):

   ```
   ## Bible Illustration Review — {scene_label}

   You are reviewing an AI-generated illustration for a Sunday school lesson for 3-5 year-olds.
   Your ONLY job is to flag problems. Do NOT rewrite doctrine. Do NOT invent theological positions.
   All flags are advisory — the teacher makes the final decision.

   ### Scripture Source (authoritative)
   {lesson-source.json content}

   ### Scene Being Illustrated
   Label: {scene_label}
   Brief: {image_brief}

   ### Image to Review
   The image is at: {image_path}
   [Note: If you can read the image, describe what you see. If you cannot, base your review
   on whether the image_brief describes anything that would fail the checklist.]

   ### Checklist
   For each check, output exactly one flag line using this format:
   [SEVERITY] scene:{scene_label} — {issue description}

   Severity levels:
   - CRITICAL: must fix before use (clear anachronism, wrong Bible character, disturbing content)
   - MAJOR: should fix (historical inaccuracy, misleading symbolism, off-brief content)
   - MINOR: consider fixing (minor inaccuracy, suboptimal but acceptable)
   - OK: no issue found

   Checks to perform:
   {CHECKLIST items as numbered list with id, label, description}

   Output ALL four checks, one line each. Then add a one-paragraph narrative summary.
   ```

5. Run the review prompt as a Claude sub-task or self-review (Bash + `claude` CLI if available, or direct self-reasoning). Write the output to `<run_dir>/bible-reviews/review-{scene_label_number}.md`.

6. Parse the flags using `parseReviewFlags`:
   ```bash
   node -e "
   const { parseReviewFlags } = require('./skills/bible-class/lib/bible_review');
   const text = require('fs').readFileSync('<path_to_review>', 'utf8');
   const flags = parseReviewFlags(text);
   console.log(JSON.stringify(flags));
   "
   ```

7. Determine result:
   - If any `CRITICAL` flag: send `review_failed(mode=bible_review, severity=CRITICAL, flags=[...])`.
   - If any `MAJOR` flag: send `review_failed(mode=bible_review, severity=MAJOR, flags=[...])`.
   - If only `MINOR`/`OK`: send `review_passed(mode=bible_review, flags=[...])`.
   - In all cases write the full review file (flags + narrative). The human decides whether to act on any flag.

**Policy constraints (always enforced):**
- Never rewrite a Bible verse, story, or theological assertion — only flag.
- Never add theological content not in `lesson-source.json`.
- Never suppress a flag because it "seems minor" — output all four checklist lines.
- The `fix loop` from the `review` mode does NOT apply — bible_review never triggers an automatic regeneration. That is always a human decision made in `bible-image-core.md`.

**Output file format (`<RD>/bible-reviews/review-{NN}.md`):**

```markdown
# Bible Review — {scene_label}

**Reviewer**: review-core agent (mode=bible_review)
**Scene**: {scene_label} — {scene_title}
**Scripture**: {book} {chapter}:{verse}
**Reviewed**: {timestamp}

## Flags

[CRITICAL|MAJOR|MINOR|OK] scene:{scene_label} — {issue or "No issue found"}
... (one line per checklist item)

## Narrative Summary

{One paragraph discussing overall accuracy, specific concerns, and anything noteworthy.}
```

**Verification Steps for `mode=bible_review`:**
- [ ] Review file written to `<RD>/bible-reviews/review-{NN}.md`.
- [ ] File contains exactly one flag line per checklist item (4 lines).
- [ ] Each flag line parses successfully with `parseReviewFlags`.
- [ ] `review_passed` or `review_failed` signal sent with correct severity.
- [ ] No theological content added beyond what is in `lesson-source.json`.
```

- [ ] **Step 4: Verify the additions are consistent**

Verification checklist (inspect the modified file):
- [ ] `mode` input line now lists `bible_review` as a third option.
- [ ] New section heading is `### Bible Review Mode Execution (`mode=bible_review`)`.
- [ ] Section describes 7 numbered execution steps.
- [ ] Policy constraints block is present (never rewrite doctrine, etc.).
- [ ] Output file format block shows the exact 3-section markdown structure.
- [ ] Verification steps section present within the new mode section.
- [ ] No existing `review` or `holistic` mode content was removed or changed.

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add agents/review-core.md
git commit -m "$(cat <<'EOF'
feat(review-core): add mode=bible_review for theological accuracy flagging

New mode checks anachronism, faithfulness, reverence, period-setting against
lesson-source.json. Only flags — never rewrites doctrine. Uses CHECKLIST from
bible_review.js and writes structured review-{NN}.md. Fix loop does not apply.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

### Spec Coverage

| Spec requirement (SUNDAY_SCHOOL_DESIGN §) | Covered by |
|---|---|
| §2.5 — 4 child style presets, lockable | Task 1: 4 YAML presets with `identity_block_template`, `style_block`, `image_aspect` |
| §2.6 — identity block + style block, master reference per-scene | Task 3: `style_lock.js`; Task 4: `scene_plan.js` includes `--reference` for scenes |
| §2.3 — `style.lock.json` with 5 keys | Task 3: `writeStyleLock` writes exact schema; `master_reference` set null then updated |
| §2.2 Phase 3 hard stop (master confirm) | Task 7: Step 6 HARD STOP with approve/redo |
| §2.2 Phase 4 per-scene generate + human confirm + redo | Task 7: Step 9 per-scene loop with 9d approval + 9e redo |
| §2.10 redo limit default 3, per-image | Task 5: `redo_state.js` REDO_LIMIT=3; Task 7 calls nextRedo |
| §2.7 theological review — only flags, never rewrites | Task 6: `bible_review.js` parseReviewFlags; Task 8: mode=bible_review policy block |
| §2.7 checklist: anachronism, faithfulness, reverence, period-setting | Task 6: CHECKLIST constant has all 4 IDs |
| Plan 1 CLI contract (--reference, --redo, --identity-file, --style-file) | Task 4: `buildGenerateArgs` matches exactly |
| Plan 2 output: `lesson-outline.json` teaching.scenes[].index + image_brief | Task 7 Step 7 reads these fields |
| Plan 4 input: `style.lock.json` schema | Task 3 writeStyleLock writes exact contract schema |

### Placeholder Scan

No `TODO`, `TBD`, `PLACEHOLDER`, `...`, or `<fill in>` strings appear in any code block in this document. Every JS function body is complete and runnable. The `write_style_lock.js` CLI wrapper is fully implemented inline in Task 7 Step 3.

### Type/Name Consistency with Shared Contracts

| Name | Defined in | Used consistently in |
|---|---|---|
| `buildStyleLock` | `style_lock.js` | Task 3 test, Task 7 write_style_lock.js |
| `writeStyleLock` | `style_lock.js` | Task 3 test, Task 7 write_style_lock.js |
| `buildGenerateArgs` | `scene_plan.js` | Task 4 test, Task 7 agent prose |
| `nextRedo` | `redo_state.js` | Task 5 test, Task 7 Step 9e |
| `REDO_LIMIT` | `redo_state.js` | Task 5 test, Task 7 Step 9e display |
| `parseReviewFlags` | `bible_review.js` | Task 6 test, Task 7 Step 9c, Task 8 Step 6 |
| `CHECKLIST` | `bible_review.js` | Task 6 test, Task 8 Step 3 |
| `style.lock.json` keys | Shared Contracts section | Task 3 `writeStyleLock`, Task 7 Step 4, Task 7 Step 6 (sets `master_reference`) |
| `style.lock.identity.txt` | Shared Contracts section | Task 3 `writeStyleLock`, generate.js `--identity-file` |
| `style.lock.style.txt` | Shared Contracts section | Task 3 `writeStyleLock`, generate.js `--style-file` |
| `<RD>/images/scene-{NN}.png` | Shared Contracts section | Task 7 Step 9b, Task 4 test outPath |
| `<RD>/master/master-reference.png` | Shared Contracts section | Task 7 Step 5, Task 4 reference arg |
| `<RD>/bible-reviews/review-{NN}.md` | Shared Contracts section | Task 7 Step 9c, Task 8 Step 5 |

### Total Task Count

8 tasks:
1. 4 YAML preset files (flat-cartoon, watercolor-storybook, pixar-3d, warm-handdrawn)
2. `skills/bible-class` package scaffold
3. `style_lock.js` + 7 tests
4. `scene_plan.js` + 9 tests
5. `redo_state.js` + 8 tests
6. `bible_review.js` + 10 tests
7. `agents/bible-image-core.md` (new agent)
8. `agents/review-core.md` extension (bible_review mode)

Total JS unit tests: 34 across tasks 3–6.
