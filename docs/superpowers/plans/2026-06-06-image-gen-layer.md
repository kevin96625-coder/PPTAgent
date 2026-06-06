# Image Generation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, multi-backend image-generation skill (`skills/image-gen/`) whose default backend drives the official Codex CLI's built-in `gpt-image-2` on the user's ChatGPT Pro subscription (no API key, no per-image billing), with metered API fallbacks, character-consistency via reference images, and an atomic cost/quota manifest.

**Architecture:** A zero-dependency Node (CommonJS) skill exposing a CLI (`scripts/generate.js`) and small pure-logic modules (`prompt`, `cost`, `manifest`, `backends`). Backends are dispatched through a registry; each backend receives an injectable `runner` (subprocess spawner) so all logic is unit-testable without calling real models. The `codex-cli` backend shells out to `codex exec` and explicitly scrubs `OPENAI_API_KEY` from the child environment so generation stays on the subscription. Every call appends an atomic entry to `<run-dir>/image-manifest.json`.

**Tech Stack:** Node.js ≥18 (CommonJS), built-in `node:test` + `node:assert` (no test deps), `child_process` for the Codex/API subprocess. Mirrors the existing `html-slide-to-pptx` skill conventions (package.json, `scripts/`, `check_env.js`).

**Why this is Plan 1 of 4:** It is the foundational, riskiest unit — it answers "can Codex-on-subscription deliver consistent characters?" and is reusable by both the new `/bible-class` feature and FUSION_PLAN's M5. Plans 2–4 (lesson workflow, scene orchestration, PPTX assembly) build on the CLI contract defined here. See the roadmap at the end and the source spec `../../../../SUNDAY_SCHOOL_DESIGN.md` + `../../../../FEASIBILITY_SUBSCRIPTION_AUTH.md`.

**Plan-wide conventions:**
- Language: plain CommonJS JS (not TS) for this skill — zero build step, so `node --test` runs directly. (Deviation from the spec's "TS suggestion" is deliberate: testability + no toolchain for a volunteer environment. The `gemini-api`/`openai-api` backends still call the same models.)
- Run all tests from the skill dir: `cd skills/image-gen`.
- Commit after every task.

---

## File Structure

```
skills/image-gen/
├── SKILL.md                  # When/how the agent invokes this skill
├── package.json              # name, type=commonjs, test=node --test
├── check_env.js              # Detect `codex` CLI + Node version
├── scripts/
│   ├── generate.js           # CLI entry: parse args → run() → write image + manifest
│   └── lib/
│       ├── prompt.js         # assembleFullPrompt() — pure
│       ├── cost.js           # estimate() — pure price/quota table
│       ├── manifest.js       # read/merge/atomic-write + redo counting + totals
│       └── backends.js       # registry + dispatch + codex-cli/gemini-api/openai-api adapters
└── test/
    ├── prompt.test.js
    ├── cost.test.js
    ├── manifest.test.js
    ├── backends.test.js
    ├── generate.test.js
    └── check_env.test.js
```

**Module responsibilities (interfaces locked here):**
- `prompt.assembleFullPrompt({sceneBrief, identityBlock, styleBlock}) -> string` — deterministic concatenation with fixed section headers.
- `cost.estimate({backend, model, count}) -> {estUsdTotal, meteredImages, quotaNote}` — pure table lookup.
- `manifest.load(runDir) -> object`, `manifest.record(runDir, label, entry) -> object`, `manifest.bumpRedo(runDir, label) -> number` — atomic via temp-file + rename.
- `backends.dispatch({backend, fullPrompt, references, aspect, seed, outPath, model, runner, env}) -> Promise<{imagePath, meta}>` — `runner({cmd, args, env, input}) -> {code, stdout, stderr}` is injectable.

---

## Task 1: Scaffold the skill

**Files:**
- Create: `skills/image-gen/package.json`
- Create: `skills/image-gen/test/smoke.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/smoke.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('package.json exists and declares commonjs', () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(pkg.type, 'commonjs');
  assert.strictEqual(pkg.name, 'image-gen');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/smoke.test.js`
Expected: FAIL — "package.json must exist".

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/package.json`:

```json
{
  "name": "image-gen",
  "version": "0.1.0",
  "description": "Multi-backend AI image generation with character-consistency. Default backend drives Codex CLI gpt-image-2 on a ChatGPT subscription (no API key).",
  "type": "commonjs",
  "private": true,
  "scripts": {
    "test": "node --test",
    "check-env": "node check_env.js",
    "gen": "node scripts/generate.js"
  },
  "license": "ISC"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/smoke.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/package.json skills/image-gen/test/smoke.test.js
git commit -m "feat(image-gen): scaffold skill package"
```

---

## Task 2: Prompt assembly (pure)

**Files:**
- Create: `skills/image-gen/scripts/lib/prompt.js`
- Test: `skills/image-gen/test/prompt.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/prompt.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { assembleFullPrompt } = require('../scripts/lib/prompt');

test('concatenates scene, identity, style with fixed headers in order', () => {
  const out = assembleFullPrompt({
    sceneBrief: 'Jesus calms the storm on the boat',
    identityBlock: 'Jesus: gentle face, brown shoulder-length hair, beige robe',
    styleBlock: 'flat rounded cartoon, bright colors, simple background',
  });
  assert.match(out, /\[CHARACTER\][\s\S]*brown shoulder-length hair/);
  assert.match(out, /\[STYLE\][\s\S]*flat rounded cartoon/);
  assert.match(out, /\[SCENE\][\s\S]*calms the storm/);
  // CHARACTER and STYLE must precede SCENE so identity/style anchor the generation
  assert.ok(out.indexOf('[CHARACTER]') < out.indexOf('[SCENE]'));
  assert.ok(out.indexOf('[STYLE]') < out.indexOf('[SCENE]'));
});

test('omits empty blocks but always keeps SCENE', () => {
  const out = assembleFullPrompt({ sceneBrief: 'A lone lamp' });
  assert.doesNotMatch(out, /\[CHARACTER\]/);
  assert.doesNotMatch(out, /\[STYLE\]/);
  assert.match(out, /\[SCENE\][\s\S]*lone lamp/);
});

test('throws when sceneBrief missing', () => {
  assert.throws(() => assembleFullPrompt({}), /sceneBrief/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/prompt.test.js`
Expected: FAIL — "Cannot find module '../scripts/lib/prompt'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/scripts/lib/prompt.js`:

```js
'use strict';

/**
 * Assemble the full image prompt. CHARACTER + STYLE blocks come first so they
 * anchor identity/style before the scene action (reduces character drift).
 * @param {{sceneBrief:string, identityBlock?:string, styleBlock?:string}} parts
 * @returns {string}
 */
function assembleFullPrompt(parts) {
  const { sceneBrief, identityBlock, styleBlock } = parts || {};
  if (!sceneBrief || !String(sceneBrief).trim()) {
    throw new Error('assembleFullPrompt: sceneBrief is required');
  }
  const sections = [];
  if (identityBlock && identityBlock.trim()) {
    sections.push(`[CHARACTER]\n${identityBlock.trim()}`);
  }
  if (styleBlock && styleBlock.trim()) {
    sections.push(`[STYLE]\n${styleBlock.trim()}`);
  }
  sections.push(`[SCENE]\n${String(sceneBrief).trim()}`);
  return sections.join('\n\n');
}

module.exports = { assembleFullPrompt };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/prompt.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/lib/prompt.js skills/image-gen/test/prompt.test.js
git commit -m "feat(image-gen): prompt assembly with character/style anchoring"
```

---

## Task 3: Cost & quota estimation (pure)

**Files:**
- Create: `skills/image-gen/scripts/lib/cost.js`
- Test: `skills/image-gen/test/cost.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/cost.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { estimate, PRICES } = require('../scripts/lib/cost');

test('codex-cli is zero metered cost but flags quota multiplier', () => {
  const r = estimate({ backend: 'codex-cli', count: 10 });
  assert.strictEqual(r.estUsdTotal, 0);
  assert.strictEqual(r.meteredImages, 0);
  assert.match(r.quotaNote, /3-5x|Codex/i);
});

test('gemini-api nano-banana-pro priced per image', () => {
  const r = estimate({ backend: 'gemini-api', model: 'nano-banana-pro', count: 13 });
  assert.strictEqual(r.meteredImages, 13);
  assert.ok(Math.abs(r.estUsdTotal - 13 * PRICES['gemini-api']['nano-banana-pro']) < 1e-9);
});

test('defaults gemini-api model to nano-banana-2', () => {
  const r = estimate({ backend: 'gemini-api', count: 1 });
  assert.ok(Math.abs(r.estUsdTotal - PRICES['gemini-api']['nano-banana-2']) < 1e-9);
});

test('unknown backend throws', () => {
  assert.throws(() => estimate({ backend: 'nope', count: 1 }), /unknown backend/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/cost.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/scripts/lib/cost.js`:

```js
'use strict';

// Per-image USD prices (2026-06, see FEASIBILITY_SUBSCRIPTION_AUTH.md §3).
const PRICES = {
  'gemini-api': {
    'nano-banana': 0.039,
    'nano-banana-2': 0.067,
    'nano-banana-pro': 0.134,
  },
  'openai-api': {
    'gpt-image-2': 0.04,
  },
};

const DEFAULT_MODEL = {
  'gemini-api': 'nano-banana-2',
  'openai-api': 'gpt-image-2',
};

/**
 * @param {{backend:string, model?:string, count:number}} opts
 * @returns {{estUsdTotal:number, meteredImages:number, quotaNote:string, model:(string|null)}}
 */
function estimate(opts) {
  const { backend, count } = opts;
  const n = Number(count) || 0;
  if (backend === 'codex-cli') {
    return {
      estUsdTotal: 0,
      meteredImages: 0,
      quotaNote: `Covered by ChatGPT subscription; image turns drain Codex quota ~3-5x faster than text (${n} images).`,
      model: 'gpt-image-2',
    };
  }
  const table = PRICES[backend];
  if (!table) throw new Error(`estimate: unknown backend "${backend}"`);
  const model = opts.model || DEFAULT_MODEL[backend];
  const price = table[model];
  if (price == null) throw new Error(`estimate: unknown model "${model}" for ${backend}`);
  return {
    estUsdTotal: n * price,
    meteredImages: n,
    quotaNote: `Metered: ${n} × $${price} via ${backend}/${model}.`,
    model,
  };
}

module.exports = { estimate, PRICES, DEFAULT_MODEL };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/cost.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/lib/cost.js skills/image-gen/test/cost.test.js
git commit -m "feat(image-gen): per-backend cost/quota estimation"
```

---

## Task 4: Manifest (atomic read/merge/write + redo + totals)

**Files:**
- Create: `skills/image-gen/scripts/lib/manifest.js`
- Test: `skills/image-gen/test/manifest.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/manifest.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load, record, bumpRedo } = require('../scripts/lib/manifest');

function tmpRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'imggen-'));
}

test('load returns empty skeleton when no manifest', () => {
  const dir = tmpRun();
  const m = load(dir);
  assert.deepStrictEqual(m.entries, {});
  assert.strictEqual(m.totals.images, 0);
  assert.strictEqual(m.totals.estUsdTotal, 0);
});

test('record writes entry and updates totals; file is valid JSON', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 0, path: 'images/scene-01.png' });
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'image-manifest.json'), 'utf8'));
  assert.strictEqual(onDisk.entries['scene-01'].backend, 'gemini-api');
  assert.strictEqual(onDisk.totals.images, 1);
  assert.ok(Math.abs(onDisk.totals.estUsdTotal - 0.067) < 1e-9);
  assert.strictEqual(onDisk.totals.meteredImages, 1);
});

test('record codex-cli entry does not count as metered', () => {
  const dir = tmpRun();
  record(dir, 'master', { backend: 'codex-cli', estUsd: 0, redoCount: 0, path: 'master/master-reference.png' });
  const m = load(dir);
  assert.strictEqual(m.totals.meteredImages, 0);
  assert.strictEqual(m.totals.images, 1);
});

test('re-recording same label replaces entry, not duplicates totals', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 0, path: 'x.png' });
  record(dir, 'scene-01', { backend: 'gemini-api', estUsd: 0.067, redoCount: 1, path: 'x.png' });
  const m = load(dir);
  assert.strictEqual(m.totals.images, 1);
  assert.strictEqual(m.entries['scene-01'].redoCount, 1);
});

test('bumpRedo increments and persists', () => {
  const dir = tmpRun();
  record(dir, 'scene-01', { backend: 'codex-cli', estUsd: 0, redoCount: 0, path: 'x.png' });
  const n = bumpRedo(dir, 'scene-01');
  assert.strictEqual(n, 1);
  assert.strictEqual(load(dir).entries['scene-01'].redoCount, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/manifest.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/scripts/lib/manifest.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FILE = 'image-manifest.json';

function manifestPath(runDir) {
  return path.join(runDir, FILE);
}

function skeleton() {
  return {
    backend_default: 'codex-cli',
    entries: {},
    totals: { images: 0, estUsdTotal: 0, meteredImages: 0 },
  };
}

function load(runDir) {
  const p = manifestPath(runDir);
  if (!fs.existsSync(p)) return skeleton();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed.entries) parsed.entries = {};
    if (!parsed.totals) parsed.totals = { images: 0, estUsdTotal: 0, meteredImages: 0 };
    return parsed;
  } catch (_) {
    return skeleton();
  }
}

function recompute(m) {
  const labels = Object.keys(m.entries);
  let estUsdTotal = 0;
  let meteredImages = 0;
  for (const l of labels) {
    const e = m.entries[l];
    estUsdTotal += Number(e.estUsd) || 0;
    if (e.backend !== 'codex-cli') meteredImages += 1;
  }
  m.totals = { images: labels.length, estUsdTotal, meteredImages };
  return m;
}

function atomicWrite(runDir, m) {
  const p = manifestPath(runDir);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  JSON.parse(fs.readFileSync(tmp, 'utf8')); // validate before swap
  fs.renameSync(tmp, p); // POSIX atomic
}

/**
 * @param {string} runDir
 * @param {string} label  e.g. "master" | "scene-01"
 * @param {{backend:string, estUsd:number, redoCount:number, path:string, seed?:number, model?:string, promptHash?:string}} entry
 */
function record(runDir, label, entry) {
  const m = load(runDir);
  m.entries[label] = {
    backend: entry.backend,
    model: entry.model || null,
    path: entry.path,
    seed: entry.seed != null ? entry.seed : null,
    estUsd: Number(entry.estUsd) || 0,
    redoCount: Number(entry.redoCount) || 0,
    promptHash: entry.promptHash || null,
    timestamp: entry.timestamp || null,
  };
  recompute(m);
  atomicWrite(runDir, m);
  return m;
}

function bumpRedo(runDir, label) {
  const m = load(runDir);
  if (!m.entries[label]) throw new Error(`bumpRedo: no entry "${label}"`);
  m.entries[label].redoCount = (Number(m.entries[label].redoCount) || 0) + 1;
  atomicWrite(runDir, m);
  return m.entries[label].redoCount;
}

module.exports = { load, record, bumpRedo, manifestPath };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/manifest.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/lib/manifest.js skills/image-gen/test/manifest.test.js
git commit -m "feat(image-gen): atomic image manifest with redo + totals"
```

---

## Task 5: Backend dispatch + codex-cli adapter (injectable runner)

**Files:**
- Create: `skills/image-gen/scripts/lib/backends.js`
- Test: `skills/image-gen/test/backends.test.js`

The `codex-cli` adapter shells out to `codex exec` and MUST scrub `OPENAI_API_KEY` from the child env (else Codex silently switches to billed API). The reference-image flag is held in one constant `CODEX_IMAGE_ARGS` and confirmed against the installed Codex version during the manual verification in Task 9.

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/backends.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { dispatch, buildCodexArgs } = require('../scripts/lib/backends');

function fakeRunner(calls) {
  return async (spec) => {
    calls.push(spec);
    return { code: 0, stdout: 'ok', stderr: '' };
  };
}

test('codex-cli scrubs OPENAI_API_KEY from child env', async () => {
  const calls = [];
  await dispatch({
    backend: 'codex-cli',
    fullPrompt: 'draw a lamb',
    references: ['/tmp/master.png'],
    outPath: '/tmp/out.png',
    runner: fakeRunner(calls),
    env: { OPENAI_API_KEY: 'sk-should-be-removed', PATH: '/usr/bin' },
  });
  assert.strictEqual(calls.length, 1);
  assert.ok(!('OPENAI_API_KEY' in calls[0].env), 'OPENAI_API_KEY must be deleted');
  assert.strictEqual(calls[0].env.PATH, '/usr/bin');
  assert.strictEqual(calls[0].cmd, 'codex');
});

test('codex args include prompt, references and out path', () => {
  const args = buildCodexArgs({ fullPrompt: 'draw', references: ['/a.png', '/b.png'], outPath: '/o.png' });
  const joined = args.join(' ');
  assert.match(joined, /exec/);
  assert.match(joined, /\/a\.png/);
  assert.match(joined, /\/b\.png/);
  assert.match(joined, /\/o\.png/);
});

test('dispatch returns imagePath and backend meta on success', async () => {
  const r = await dispatch({
    backend: 'codex-cli', fullPrompt: 'x', references: [], outPath: '/tmp/o.png',
    runner: async () => ({ code: 0, stdout: '', stderr: '' }), env: {},
  });
  assert.strictEqual(r.imagePath, '/tmp/o.png');
  assert.strictEqual(r.meta.backend, 'codex-cli');
});

test('dispatch throws on non-zero exit', async () => {
  await assert.rejects(dispatch({
    backend: 'codex-cli', fullPrompt: 'x', references: [], outPath: '/tmp/o.png',
    runner: async () => ({ code: 1, stdout: '', stderr: 'boom' }), env: {},
  }), /codex-cli failed/);
});

test('gemini-api adapter calls runner with model + key from env', async () => {
  const calls = [];
  await dispatch({
    backend: 'gemini-api', model: 'nano-banana-pro', fullPrompt: 'x', references: [],
    outPath: '/tmp/o.png', runner: fakeRunner(calls), env: { GEMINI_API_KEY: 'k' },
  });
  assert.match(calls[0].args.join(' '), /nano-banana-pro/);
});

test('unknown backend throws', async () => {
  await assert.rejects(dispatch({ backend: 'nope', fullPrompt: 'x', references: [], outPath: '/o', runner: async () => ({}), env: {} }), /unknown backend/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/backends.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/scripts/lib/backends.js`:

```js
'use strict';

// Codex `exec` argument template. The reference-image flag (`--image`) is the
// one runtime-version-dependent piece — verified in Task 9 against the installed
// codex version. Keep all Codex specifics here.
function buildCodexArgs({ fullPrompt, references, outPath }) {
  const args = ['exec'];
  for (const ref of references || []) {
    args.push('--image', ref);
  }
  // Instruct the built-in image_gen tool explicitly and pin the output path.
  const instruction =
    `$imagegen Generate ONE image and save it to "${outPath}". ` +
    `Use the attached reference image(s) to keep the main character visually identical. ` +
    `Prompt:\n${fullPrompt}`;
  args.push(instruction);
  return args;
}

function buildGeminiArgs({ fullPrompt, references, outPath, model }) {
  const args = ['--model', model || 'nano-banana-2', '--out', outPath];
  for (const ref of references || []) args.push('--reference', ref);
  args.push('--prompt', fullPrompt);
  return args;
}

function buildOpenaiArgs({ fullPrompt, references, outPath, model }) {
  const args = ['--model', model || 'gpt-image-2', '--out', outPath];
  for (const ref of references || []) args.push('--image', ref);
  args.push('--prompt', fullPrompt);
  return args;
}

async function dispatch(opts) {
  const { backend, fullPrompt, references = [], outPath, runner } = opts;
  const env = Object.assign({}, opts.env || {});

  if (backend === 'codex-cli') {
    // CRITICAL: never let Codex see an API key, or it bills the API instead of the subscription.
    delete env.OPENAI_API_KEY;
    const args = buildCodexArgs({ fullPrompt, references, outPath });
    const res = await runner({ cmd: 'codex', args, env });
    if (!res || res.code !== 0) {
      throw new Error(`codex-cli failed (code ${res && res.code}): ${res && res.stderr}`);
    }
    return { imagePath: outPath, meta: { backend, model: 'gpt-image-2' } };
  }

  if (backend === 'gemini-api') {
    const model = opts.model || 'nano-banana-2';
    const args = buildGeminiArgs({ fullPrompt, references, outPath, model });
    const res = await runner({ cmd: 'image-gen-gemini', args, env });
    if (!res || res.code !== 0) throw new Error(`gemini-api failed (code ${res && res.code}): ${res && res.stderr}`);
    return { imagePath: outPath, meta: { backend, model } };
  }

  if (backend === 'openai-api') {
    const model = opts.model || 'gpt-image-2';
    const args = buildOpenaiArgs({ fullPrompt, references, outPath, model });
    const res = await runner({ cmd: 'image-gen-openai', args, env });
    if (!res || res.code !== 0) throw new Error(`openai-api failed (code ${res && res.code}): ${res && res.stderr}`);
    return { imagePath: outPath, meta: { backend, model } };
  }

  throw new Error(`dispatch: unknown backend "${backend}"`);
}

module.exports = { dispatch, buildCodexArgs, buildGeminiArgs, buildOpenaiArgs };
```

> Note: `gemini-api`/`openai-api` adapters define the CLI contract (`image-gen-gemini`/`image-gen-openai`) whose concrete API-calling scripts are implemented in a later plan when metered fallback is actually wired; here they are dispatched through the injectable runner so the dispatch logic is fully tested. The default `codex-cli` path is complete.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/backends.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/lib/backends.js skills/image-gen/test/backends.test.js
git commit -m "feat(image-gen): backend dispatch + codex-cli adapter (scrubs OPENAI_API_KEY)"
```

---

## Task 6: Default subprocess runner (real spawn)

**Files:**
- Modify: `skills/image-gen/scripts/lib/backends.js` (add `defaultRunner`)
- Test: `skills/image-gen/test/backends.test.js` (add runner test)

- [ ] **Step 1: Write the failing test**

Append to `skills/image-gen/test/backends.test.js`:

```js
const { defaultRunner } = require('../scripts/lib/backends');

test('defaultRunner executes a real process and captures exit code + stdout', async () => {
  const res = await defaultRunner({ cmd: 'node', args: ['-e', "process.stdout.write('hi')"], env: process.env });
  assert.strictEqual(res.code, 0);
  assert.match(res.stdout, /hi/);
});

test('defaultRunner reports non-zero exit', async () => {
  const res = await defaultRunner({ cmd: 'node', args: ['-e', 'process.exit(3)'], env: process.env });
  assert.strictEqual(res.code, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/backends.test.js`
Expected: FAIL — "defaultRunner is not a function".

- [ ] **Step 3: Write minimal implementation**

Add to `skills/image-gen/scripts/lib/backends.js` (above `module.exports`):

```js
const { spawn } = require('node:child_process');

/**
 * Real subprocess runner. @param {{cmd, args, env, input?}} spec
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function defaultRunner(spec) {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.cmd, spec.args, { env: spec.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code == null ? -1 : code, stdout, stderr }));
    if (spec.input != null) { child.stdin.write(spec.input); child.stdin.end(); }
  });
}
```

Update the export line:

```js
module.exports = { dispatch, defaultRunner, buildCodexArgs, buildGeminiArgs, buildOpenaiArgs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/backends.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/lib/backends.js skills/image-gen/test/backends.test.js
git commit -m "feat(image-gen): real subprocess runner"
```

---

## Task 7: CLI entry (`generate.js`) — arg parsing, estimate, run, manifest

**Files:**
- Create: `skills/image-gen/scripts/generate.js`
- Test: `skills/image-gen/test/generate.test.js`

CLI contract:
```
node scripts/generate.js \
  --run-dir <dir> --label scene-03 --out <path.png> \
  (--prompt "<text>" | --prompt-file <file>) \
  [--identity-file <file>] [--style-file <file>] \
  [--reference <a.png,b.png>] \
  [--backend codex-cli|gemini-api|openai-api]  (default codex-cli) \
  [--model <name>] [--aspect 4:3] [--seed 7] \
  [--redo] [--estimate-only]
```

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/generate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, run } = require('../scripts/generate');

function tmpRun() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); }

test('parseArgs defaults backend to codex-cli and splits references', () => {
  const a = parseArgs(['--run-dir', '/r', '--label', 'scene-01', '--out', '/o.png',
    '--prompt', 'hi', '--reference', '/a.png,/b.png']);
  assert.strictEqual(a.backend, 'codex-cli');
  assert.deepStrictEqual(a.references, ['/a.png', '/b.png']);
  assert.strictEqual(a.label, 'scene-01');
});

test('run with --estimate-only returns estimate and writes nothing', async () => {
  const dir = tmpRun();
  const out = await run(parseArgs([
    '--run-dir', dir, '--label', 'scene-01', '--out', path.join(dir, 'o.png'),
    '--prompt', 'a lamb', '--backend', 'gemini-api', '--model', 'nano-banana-pro', '--estimate-only',
  ]), { runner: async () => ({ code: 0 }) });
  assert.ok(out.estimate.estUsdTotal > 0);
  assert.strictEqual(fs.existsSync(path.join(dir, 'image-manifest.json')), false);
});

test('run (codex-cli) invokes runner, writes manifest entry with zero cost', async () => {
  const dir = tmpRun();
  const outPath = path.join(dir, 'o.png');
  const calls = [];
  const out = await run(parseArgs([
    '--run-dir', dir, '--label', 'master', '--out', outPath, '--prompt', 'jesus',
    '--reference', '/m.png',
  ]), { runner: async (s) => { calls.push(s); fs.writeFileSync(outPath, 'PNG'); return { code: 0, stdout: '', stderr: '' }; } });

  assert.strictEqual(out.imagePath, outPath);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'image-manifest.json'), 'utf8'));
  assert.strictEqual(m.entries.master.backend, 'codex-cli');
  assert.strictEqual(m.entries.master.estUsd, 0);
  assert.ok(!('OPENAI_API_KEY' in calls[0].env));
});

test('run throws if neither --prompt nor --prompt-file given', async () => {
  await assert.rejects(run(parseArgs(['--run-dir', '/r', '--label', 'x', '--out', '/o.png']), {}), /prompt/);
});

test('run with --redo bumps redo count on existing label', async () => {
  const dir = tmpRun();
  const outPath = path.join(dir, 'o.png');
  const opts = { runner: async () => { fs.writeFileSync(outPath, 'PNG'); return { code: 0 }; } };
  const base = ['--run-dir', dir, '--label', 'scene-01', '--out', outPath, '--prompt', 'x'];
  await run(parseArgs(base), opts);
  const out2 = await run(parseArgs(base.concat(['--redo'])), opts);
  assert.strictEqual(out2.redoCount, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/generate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/scripts/generate.js`:

```js
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { assembleFullPrompt } = require('./lib/prompt');
const { estimate } = require('./lib/cost');
const manifest = require('./lib/manifest');
const { dispatch, defaultRunner } = require('./lib/backends');

function parseArgs(argv) {
  const a = {
    backend: 'codex-cli', references: [], aspect: '4:3', seed: null,
    redo: false, estimateOnly: false, model: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--run-dir': a.runDir = v; i++; break;
      case '--label': a.label = v; i++; break;
      case '--out': a.out = v; i++; break;
      case '--prompt': a.prompt = v; i++; break;
      case '--prompt-file': a.promptFile = v; i++; break;
      case '--identity-file': a.identityFile = v; i++; break;
      case '--style-file': a.styleFile = v; i++; break;
      case '--reference': a.references = String(v).split(',').map((s) => s.trim()).filter(Boolean); i++; break;
      case '--backend': a.backend = v; i++; break;
      case '--model': a.model = v; i++; break;
      case '--aspect': a.aspect = v; i++; break;
      case '--seed': a.seed = Number(v); i++; break;
      case '--redo': a.redo = true; break;
      case '--estimate-only': a.estimateOnly = true; break;
      default: break;
    }
  }
  return a;
}

function readMaybe(file) {
  return file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

async function run(args, deps = {}) {
  const runner = deps.runner || defaultRunner;
  const env = deps.env || process.env;
  if (!args.runDir || !args.label || !args.out) {
    throw new Error('run: --run-dir, --label and --out are required');
  }
  const sceneBrief = args.prompt || readMaybe(args.promptFile);
  if (!sceneBrief || !sceneBrief.trim()) {
    throw new Error('run: provide --prompt or --prompt-file');
  }
  const fullPrompt = assembleFullPrompt({
    sceneBrief,
    identityBlock: readMaybe(args.identityFile),
    styleBlock: readMaybe(args.styleFile),
  });

  const est = estimate({ backend: args.backend, model: args.model, count: 1 });
  if (args.estimateOnly) {
    return { estimate: est, fullPrompt };
  }

  const { imagePath, meta } = await dispatch({
    backend: args.backend, model: args.model, fullPrompt,
    references: args.references, aspect: args.aspect, seed: args.seed,
    outPath: args.out, runner, env,
  });

  const promptHash = crypto.createHash('sha256').update(fullPrompt).digest('hex').slice(0, 12);
  const existing = manifest.load(args.runDir).entries[args.label];
  const redoCount = args.redo && existing ? (existing.redoCount || 0) + 1 : (existing ? existing.redoCount || 0 : 0);

  manifest.record(args.runDir, args.label, {
    backend: meta.backend, model: meta.model, path: imagePath,
    seed: args.seed, estUsd: est.estUsdTotal, redoCount, promptHash,
  });

  return { imagePath, estimate: est, redoCount, fullPrompt };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((r) => {
      if (r.estimate && !r.imagePath) {
        console.log(JSON.stringify({ estimate: r.estimate }, null, 2));
      } else {
        console.log(JSON.stringify({ imagePath: r.imagePath, estimate: r.estimate, redoCount: r.redoCount }, null, 2));
      }
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { parseArgs, run };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/generate.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/generate.js skills/image-gen/test/generate.test.js
git commit -m "feat(image-gen): generate CLI with estimate, dispatch, manifest"
```

---

## Task 8: Environment check (`check_env.js`)

**Files:**
- Create: `skills/image-gen/check_env.js`
- Test: `skills/image-gen/test/check_env.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/image-gen/test/check_env.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { checkEnv } = require('../check_env');

test('reports codex present when which() finds it', () => {
  const r = checkEnv({ which: () => '/usr/local/bin/codex', nodeMajor: 20 });
  assert.strictEqual(r.codexAvailable, true);
  assert.strictEqual(r.ok, true);
});

test('reports codex missing and not ok for default backend', () => {
  const r = checkEnv({ which: () => null, nodeMajor: 20 });
  assert.strictEqual(r.codexAvailable, false);
  assert.match(r.hint, /codex/i);
  assert.strictEqual(r.ok, false);
});

test('flags old node', () => {
  const r = checkEnv({ which: () => '/bin/codex', nodeMajor: 16 });
  assert.strictEqual(r.ok, false);
  assert.match(r.hint, /Node/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/image-gen && node --test test/check_env.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `skills/image-gen/check_env.js`:

```js
'use strict';

const { execSync } = require('node:child_process');

function realWhich(cmd) {
  try {
    return execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {{which:Function, nodeMajor:number}} deps
 */
function checkEnv(deps) {
  const which = deps.which || realWhich;
  const nodeMajor = deps.nodeMajor != null ? deps.nodeMajor : Number(process.versions.node.split('.')[0]);
  const codexPath = which('codex');
  const codexAvailable = !!codexPath;
  let ok = true;
  const hints = [];
  if (nodeMajor < 18) { ok = false; hints.push('Node >= 18 required.'); }
  if (!codexAvailable) {
    ok = false;
    hints.push('Default backend needs the `codex` CLI (Sign in with ChatGPT). Install it, or pass --backend gemini-api with GEMINI_API_KEY.');
  }
  return { ok, codexAvailable, codexPath, nodeMajor, hint: hints.join(' ') };
}

if (require.main === module) {
  const r = checkEnv({});
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
}

module.exports = { checkEnv };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/image-gen && node --test test/check_env.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd skills/image-gen && node --test`
Expected: PASS — all tests across all files green.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/check_env.js skills/image-gen/test/check_env.test.js
git commit -m "feat(image-gen): environment check for codex CLI + node"
```

---

## Task 9: SKILL.md + manual integration verification (real Codex)

**Files:**
- Create: `skills/image-gen/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `skills/image-gen/SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Confirm the Codex reference-image flag against the installed CLI**

Run: `codex --help 2>&1 | grep -iE "image|exec" || codex exec --help 2>&1 | head -40`
Expected: confirm how reference images attach (e.g. `--image <path>`). If the flag differs from `--image`, update `buildCodexArgs` in `scripts/lib/backends.js` accordingly and re-run `node --test test/backends.test.js`.

- [ ] **Step 3: Real generation smoke test (consistency check)**

```bash
cd skills/image-gen
mkdir -p /tmp/igrun/master /tmp/igrun/images
# 1) master reference
node scripts/generate.js --run-dir /tmp/igrun --label master \
  --out /tmp/igrun/master/master-reference.png \
  --prompt "A gentle, friendly Jesus for preschoolers, beige robe, brown shoulder-length hair, warm smile" \
  --style-file /dev/stdin <<<'flat rounded cartoon, bright cheerful colors, simple background, no text'
# 2) a scene using the master as reference
node scripts/generate.js --run-dir /tmp/igrun --label scene-01 \
  --out /tmp/igrun/images/scene-01.png \
  --prompt "The same Jesus calming a storm on a small wooden boat, gentle waves" \
  --reference /tmp/igrun/master/master-reference.png
```
Expected: two PNG files exist; open them and confirm the Jesus figure looks like the SAME character. Confirm `/tmp/igrun/image-manifest.json` has `master` + `scene-01` entries with `backend: "codex-cli"` and `estUsd: 0`.

**Record the result in the plan checkbox.** If character consistency is inadequate, retry with `--backend gemini-api --model nano-banana-pro` (needs `GEMINI_API_KEY`) and compare — this is the decision point for the default backend (spec open question #2).

- [ ] **Step 4: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/SKILL.md
git commit -m "docs(image-gen): SKILL.md + verified codex integration"
```

---

## Self-Review (completed)

- **Spec coverage:** Covers SUNDAY_SCHOOL_DESIGN §2.4 (multi-backend abstraction, codex-cli default, reference-image consistency, no OPENAI_API_KEY) and §2.10 (cost/quota guard via estimate + manifest totals), and FEASIBILITY §5 (default codex-cli, metered fallback). Master-reference + identity/style blocks (§2.6) are honored by the prompt assembler + `--reference`/`--identity-file`/`--style-file`. The per-scene orchestration, lesson outline, theological review, style presets and PPTX assembly are OUT OF SCOPE here → Plans 2–4.
- **Placeholder scan:** No TBD/TODO; every code step is complete runnable code.
- **Type/name consistency:** `assembleFullPrompt`, `estimate`, `manifest.{load,record,bumpRedo}`, `dispatch`, `defaultRunner`, `buildCodexArgs`, `parseArgs`, `run`, `checkEnv` are used consistently across tasks. Manifest field `estUsd` and totals `estUsdTotal` are consistent.

---

## Roadmap: Plans 2–4 (to be written after Plan 1 verifies)

Each is a separate plan file under `docs/superpowers/plans/`, each producing working, testable software.

**Plan 2 — Lesson intake + outline (`/bible-class` Phases 1–2).**
- New `commands/bible-class.md` (Init + intake of lesson plan image/text → `lesson-source.json`).
- `agents/content-core.md` new `mode=lesson_outline` → `lesson-outline.json` (scenes with `image_brief`, 15min teach) + `craft.md` (15min craft, text only) + hard-stop approval/revise.
- Testable units: a `lesson-source` schema validator (Python, mirrors `planning_validator.py`) and an `lesson-outline` schema validator.

**Plan 3 — Style + master + scene orchestration (`/bible-class` Phases 3–4).**
- 4 kid style presets `skills/_shared/references/styles/children/*.yaml` + `style.lock` writer (identity/style blocks).
- New `agents/bible-image-core.md` orchestrating: master reference (hard stop) → per-scene `generate.js` calls with reference image → per-image human approval + single-image redo (uses `--redo`).
- `agents/review-core.md` new `mode=bible_review` (anachronism/faithfulness flags against `lesson-source.json`).
- Testable units: style-lock writer, redo-loop state, bible-review checklist parser.

**Plan 4 — PPTX assembly + delivery (`/bible-class` Phases 5–6).**
- New `storybook` preset in `html-slide-to-pptx` (full-bleed image object + editable caption text box; reuse `layout_utils.js` CJK fitting).
- HTML preview (reuse `preview-template.html`) + `speaker-notes.md` + bundle `craft.md`.
- Testable units: storybook DOM extractor + preflight QA (overflow/edge), HTML composer.
```
