# `--stop-at` Implementation Plan (Fusion M1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--stop-at=<research|outline|draft|design|full>` flag to `/ppt-agent:ppt` so users can stop the 7-phase workflow at any stage, get a clean partial delivery, and later resume to completion with `--run-id`.

**Architecture:** The stop decision (validate the flag, compare it against how far a resumed run has progressed, decide run-vs-already-done, emit the resume hint) is **pure logic** extracted into a unit-tested Node module under `skills/_shared/`. A thin CLI exposes it so the prose orchestrator in `commands/ppt.md` can call it deterministically; the same 5 interaction rules are also written in prose so the flow degrades gracefully when Node is absent (per FUSION's "Node 可选依赖" principle). Each of Phases 3–6 gets a stop checkpoint that does early delivery (copy stage artifacts to `output/` + write `output/README.md`) and halts.

**Tech Stack:** Node 22 (CommonJS, `node:test`) for the helper + tests; Markdown prose + embedded bash for the `commands/ppt.md` orchestration; grep-style structure tests guard the prose (the bible-class-validated convention: pure logic → `node:test`, markdown → grep checks).

---

## Background (read before starting)

- The whole `/ppt` workflow is **prose interpreted by the Claude Code host** in `commands/ppt.md` — there is no runtime engine. `--stop-at` is therefore implemented as (a) a small tested Node decision helper + (b) prose instructions wired into the command.
- The 7 phases: 1 Init · 2 Research (Hard Stop) · 3 Material Collection · 4 Outline (Hard Stop) · 5 Planning Draft · 6 Design+Review · 7 Delivery (Hard Stop).
- `--run-id` resume already exists: `commands/ppt.md` Phase 1 "Resume detection" derives a resume point from existing artifacts (`research-context.md` → `requirements.md` → `materials.md` → `outline.json`(`approved`) → `draft-manifest.json` → `slide-status.json`). **This plan reuses that; it does not rebuild resume.**
- Convention to mirror exactly (from `skills/image-gen`): a skill dir has `package.json` (`"type":"commonjs"`, `"scripts":{"test":"node --test"}`), pure logic in `scripts/lib/*.js` with `'use strict'` + `module.exports`, tests in `test/*.test.js` using `require('node:test')`. Run tests with `node --test` from the skill dir.
- `skills/_shared/` currently has only `references/`, `assets/`, `index.json` — **no** `scripts/`, `test/`, or `package.json` yet. Task 1 creates that infra.

### `--stop-at` spec (source: FUSION_PLAN.md §"Phase 2", lines 177–223)

| value | stops after | stage artifacts |
|-------|-------------|-----------------|
| `research` | Phase 3 | `research-context.md`, `requirements.md`, `materials.md` |
| `outline` | Phase 4 | `outline.json`, `outline-preview.md` |
| `draft` | Phase 5 | `drafts/*.svg`, `draft-manifest.json` |
| `design` | Phase 6 | `slides/*.svg`, `reviews/*.md`, `review-manifest.json` |
| `full` (default) | Phase 7 | full delivery (`output/`) |

Interaction rules with `--run-id`:
1. Resume reads artifacts → breakpoint stage (existing logic).
2. `stopAt` rank > completed rank → run from breakpoint up to and including `stopAt`, then stop.
3. `stopAt` rank ≤ completed rank → "already complete", show artifact locations, do nothing.
4. No `--stop-at` → default `full` (current behaviour, unchanged).
5. `--stop-at=outline` but outline already `approved: true` → emit hint to continue design via `--run-id`.

---

## File Structure

- Create `skills/_shared/package.json` — test runner for shared workflow logic.
- Create `skills/_shared/scripts/lib/stop-at.js` — pure decision logic (no I/O).
- Create `skills/_shared/scripts/stop-at-cli.js` — thin CLI wrapper printing a JSON decision.
- Create `skills/_shared/test/stop-at.test.js` — unit tests for the decision logic.
- Create `skills/_shared/test/ppt-command.test.js` — structure (grep) tests asserting the prose wiring exists in `commands/ppt.md`.
- Modify `commands/ppt.md` — argument-hint, Phase 1 flag parse + decision call, four phase-boundary stop checkpoints, the shared early-delivery README block.
- Modify `CLAUDE.md` (plugin root) — document the new flag.

---

## Task 1: Scaffold `_shared` test infra + stop-at parse/order logic

**Files:**
- Create: `skills/_shared/package.json`
- Create: `skills/_shared/scripts/lib/stop-at.js`
- Test: `skills/_shared/test/stop-at.test.js`

- [ ] **Step 1: Create the package manifest**

Create `skills/_shared/package.json`:

```json
{
  "name": "ppt-shared",
  "version": "0.1.0",
  "description": "Shared workflow logic for the /ppt command (stop-at decision, etc.).",
  "type": "commonjs",
  "private": true,
  "scripts": {
    "test": "node --test"
  },
  "license": "ISC"
}
```

- [ ] **Step 2: Write the failing test** for parse + ordering

Create `skills/_shared/test/stop-at.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { STAGES, STAGE_PHASE, parseStopAt, stageRank } = require('../scripts/lib/stop-at');

test('STAGES are ordered research<outline<draft<design<full', () => {
  assert.deepStrictEqual(STAGES, ['research', 'outline', 'draft', 'design', 'full']);
});

test('STAGE_PHASE maps each stage to the phase it completes after', () => {
  assert.deepStrictEqual(STAGE_PHASE, {
    research: 3, outline: 4, draft: 5, design: 6, full: 7,
  });
});

test('parseStopAt defaults empty/undefined to full', () => {
  assert.strictEqual(parseStopAt(undefined), 'full');
  assert.strictEqual(parseStopAt(''), 'full');
  assert.strictEqual(parseStopAt('  '), 'full');
});

test('parseStopAt normalizes case/whitespace', () => {
  assert.strictEqual(parseStopAt(' Outline '), 'outline');
  assert.strictEqual(parseStopAt('DESIGN'), 'design');
});

test('parseStopAt rejects unknown values with a helpful message', () => {
  assert.throws(() => parseStopAt('slides'), /Invalid --stop-at "slides".*research, outline, draft, design, full/s);
});

test('stageRank: none=0, research=1 ... full=5', () => {
  assert.strictEqual(stageRank('none'), 0);
  assert.strictEqual(stageRank(undefined), 0);
  assert.strictEqual(stageRank('research'), 1);
  assert.strictEqual(stageRank('full'), 5);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd skills/_shared && node --test`
Expected: FAIL — `Cannot find module '../scripts/lib/stop-at'`.

- [ ] **Step 4: Write the minimal implementation**

Create `skills/_shared/scripts/lib/stop-at.js`:

```js
'use strict';

// Pure decision logic for the /ppt --stop-at flag. No I/O — unit-tested.

// Ordered stop targets. Order is load-bearing: research < outline < draft < design < full.
const STAGES = ['research', 'outline', 'draft', 'design', 'full'];

// The ppt.md phase each stop target completes *after*.
const STAGE_PHASE = { research: 3, outline: 4, draft: 5, design: 6, full: 7 };

function parseStopAt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 'full';
  const v = String(raw).trim().toLowerCase();
  if (!STAGES.includes(v)) {
    throw new Error(`Invalid --stop-at "${raw}". Valid values: ${STAGES.join(', ')}`);
  }
  return v;
}

// 'none'/empty → 0 (nothing completed). research..full → 1..5. Unknown → throw.
function stageRank(stage) {
  if (stage === 'none' || stage === undefined || stage === null || String(stage).trim() === '') return 0;
  const i = STAGES.indexOf(String(stage).trim().toLowerCase());
  if (i < 0) throw new Error(`Unknown stage "${stage}"`);
  return i + 1;
}

module.exports = { STAGES, STAGE_PHASE, parseStopAt, stageRank };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd skills/_shared && node --test`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add skills/_shared/package.json skills/_shared/scripts/lib/stop-at.js skills/_shared/test/stop-at.test.js
git commit -m "feat(ppt): add stop-at stage parsing + ordering (Fusion M1)"
```

---

## Task 2: stop-at × run-id interaction decision

**Files:**
- Modify: `skills/_shared/scripts/lib/stop-at.js`
- Test: `skills/_shared/test/stop-at.test.js`

- [ ] **Step 1: Add the failing tests** — append to `skills/_shared/test/stop-at.test.js`:

```js
const { NEXT_STAGE, resolveStopAction } = require('../scripts/lib/stop-at');

test('NEXT_STAGE chains research→outline→…→full→null', () => {
  assert.deepStrictEqual(NEXT_STAGE, {
    research: 'outline', outline: 'draft', draft: 'design', design: 'full', full: null,
  });
});

test('fresh run, stop-at=outline → run to outline (Phase 4)', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'none' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.target, 'outline');
  assert.strictEqual(d.stopPhase, 4);
  assert.strictEqual(d.nextStage, 'draft');
});

test('no stop-at defaults to full and runs', () => {
  const d = resolveStopAction({ completed: 'none' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.target, 'full');
  assert.strictEqual(d.stopPhase, 7);
});

test('stop-at <= completed → already-done', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'design' });
  assert.strictEqual(d.action, 'already-done');
  assert.match(d.message, /already complete/i);
});

test('stop-at == completed (equal rank) → already-done', () => {
  const d = resolveStopAction({ stopAt: 'draft', completed: 'draft' });
  assert.strictEqual(d.action, 'already-done');
});

test('stop-at > completed → run (continue from breakpoint)', () => {
  const d = resolveStopAction({ stopAt: 'design', completed: 'outline' });
  assert.strictEqual(d.action, 'run');
  assert.strictEqual(d.stopPhase, 6);
});

test('outline already approved → hint to continue design via run-id', () => {
  const d = resolveStopAction({ stopAt: 'outline', completed: 'outline', outlineApproved: true });
  assert.strictEqual(d.action, 'already-done');
  assert.match(d.message, /--run-id=<id> --stop-at=full/);
});

test('invalid stop-at bubbles up from resolveStopAction', () => {
  assert.throws(() => resolveStopAction({ stopAt: 'nope', completed: 'none' }), /Invalid --stop-at/);
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd skills/_shared && node --test`
Expected: FAIL — `NEXT_STAGE`/`resolveStopAction` are `undefined` (not exported).

- [ ] **Step 3: Implement** — edit `skills/_shared/scripts/lib/stop-at.js`.

Add after the `STAGE_PHASE` constant:

```js
// The next stop target after an early stop (drives the resume hint). 'full' has none.
const NEXT_STAGE = { research: 'outline', outline: 'draft', draft: 'design', design: 'full', full: null };
```

Add before `module.exports`:

```js
/**
 * Decide what to do given a stop target and how far a (possibly resumed) run has progressed.
 * @param {{stopAt?:string, completed?:string, outlineApproved?:boolean}} opts
 *   stopAt: raw flag value (undefined → 'full')
 *   completed: highest fully-completed stop stage, or 'none' for a fresh run
 *   outlineApproved: whether outline.json has "approved": true
 * @returns {{action:'run'|'already-done', target:string, stopPhase:number, nextStage:(string|null), message:string}}
 */
function resolveStopAction(opts = {}) {
  const target = parseStopAt(opts.stopAt);
  const completed = opts.completed == null ? 'none' : opts.completed;
  const ti = stageRank(target);
  const ci = stageRank(completed);
  const stopPhase = STAGE_PHASE[target];
  const nextStage = NEXT_STAGE[target];

  if (ti <= ci) {
    let message = `Stage "${target}" is already complete; its artifacts are available in the run directory.`;
    if (target === 'outline' && opts.outlineApproved) {
      message = `Outline already approved. Continue design with: /ppt-agent:ppt --run-id=<id> --stop-at=full`;
    }
    return { action: 'already-done', target, stopPhase, nextStage, message };
  }
  return {
    action: 'run',
    target,
    stopPhase,
    nextStage,
    message: `Run through stage "${target}" (Phase ${stopPhase}), then stop.`,
  };
}
```

Update the exports line to:

```js
module.exports = { STAGES, STAGE_PHASE, NEXT_STAGE, parseStopAt, stageRank, resolveStopAction };
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `cd skills/_shared && node --test`
Expected: PASS — all tests (Task 1 + Task 2) green.

- [ ] **Step 5: Commit**

```bash
git add skills/_shared/scripts/lib/stop-at.js skills/_shared/test/stop-at.test.js
git commit -m "feat(ppt): add stop-at × run-id interaction decision (Fusion M1)"
```

---

## Task 3: CLI wrapper + wire Phase 1 of `commands/ppt.md`

**Files:**
- Create: `skills/_shared/scripts/stop-at-cli.js`
- Modify: `commands/ppt.md:3` (argument-hint) and Phase 1 (flag parse + decision)
- Test: `skills/_shared/test/ppt-command.test.js`

- [ ] **Step 1: Write the CLI** `skills/_shared/scripts/stop-at-cli.js`:

```js
#!/usr/bin/env node
'use strict';

// Thin CLI over scripts/lib/stop-at.js. Prints a JSON decision to stdout.
// Usage: node stop-at-cli.js --stop-at <v> [--completed <stage>] [--outline-approved <true|false>]
// Exit 0 with JSON on success; exit 1 with { "error": "..." } on invalid flag.

const { resolveStopAction } = require('./lib/stop-at');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

try {
  const decision = resolveStopAction({
    stopAt: arg('--stop-at', undefined),
    completed: arg('--completed', 'none'),
    outlineApproved: arg('--outline-approved', 'false') === 'true',
  });
  process.stdout.write(JSON.stringify(decision) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
  process.exit(1);
}
```

- [ ] **Step 2: Manually verify the CLI** (sanity, not committed as a test)

Run: `node skills/_shared/scripts/stop-at-cli.js --stop-at outline --completed none`
Expected stdout: `{"action":"run","target":"outline","stopPhase":4,"nextStage":"draft","message":"Run through stage \"outline\" (Phase 4), then stop."}`

Run: `node skills/_shared/scripts/stop-at-cli.js --stop-at slides`
Expected: stdout `{"error":"Invalid --stop-at \"slides\". Valid values: research, outline, draft, design, full"}` and exit code 1.

- [ ] **Step 3: Write the failing structure test** `skills/_shared/test/ppt-command.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PPT = fs.readFileSync(path.join(__dirname, '../../../commands/ppt.md'), 'utf8');

test('argument-hint advertises --stop-at', () => {
  const hint = PPT.split('\n').find((l) => l.startsWith('argument-hint:'));
  assert.ok(hint && hint.includes('--stop-at'), 'argument-hint should mention --stop-at');
});

test('Phase 1 parses --stop-at and calls the decision helper', () => {
  assert.match(PPT, /--stop-at/);
  assert.match(PPT, /stop-at-cli\.js/);
});

test('prose lists all five stop-at stages', () => {
  for (const s of ['research', 'outline', 'draft', 'design', 'full']) {
    assert.match(PPT, new RegExp(`\\b${s}\\b`), `prose should mention stage ${s}`);
  }
});
```

- [ ] **Step 4: Run to verify the structure test fails**

Run: `cd skills/_shared && node --test test/ppt-command.test.js`
Expected: FAIL — `ppt.md` does not yet contain `stop-at-cli.js` / `--stop-at`.

- [ ] **Step 5: Edit `commands/ppt.md` — argument-hint (line 3)**

Replace:
```
argument-hint: "[--style=<style>] [--brand-colors=<path>] [--pages=10-15] [--run-id=<id>] <topic>"
```
with:
```
argument-hint: "[--style=<style>] [--brand-colors=<path>] [--pages=10-15] [--run-id=<id>] [--stop-at=research|outline|draft|design|full] <topic>"
```

- [ ] **Step 6: Edit `commands/ppt.md` — Phase 1 flag parse**

In "## Phase 1: Init", change item 1's opening from:
```
1. Parse flags: `--style` (optional), `--pages` (default: `10-15`), `--run-id`.
```
to:
```
1. Parse flags: `--style` (optional), `--pages` (default: `10-15`), `--run-id`, `--stop-at` (optional, default `full`).
```

- [ ] **Step 7: Edit `commands/ppt.md` — add the decision step at the end of Phase 1**

After Phase 1 item 6 ("Write `${RUN_DIR}/input.md` ..."), insert this new item:

````
7. **Resolve the stop target** (`--stop-at`). The valid stages, in order, are
   `research` (stops after Phase 3) · `outline` (Phase 4) · `draft` (Phase 5) ·
   `design` (Phase 6) · `full` (Phase 7, default). Determine `COMPLETED_STAGE`
   from the Resume detection above (`none` for a fresh run; otherwise the highest
   fully-completed stage), then resolve the action:

   ```bash
   # APPROVED = "true" if outline.json exists with "approved": true, else "false"
   node skills/_shared/scripts/stop-at-cli.js \
     --stop-at "${STOP_AT:-full}" \
     --completed "${COMPLETED_STAGE:-none}" \
     --outline-approved "${APPROVED:-false}"
   ```

   The command prints a JSON decision `{ action, target, stopPhase, nextStage, message }`.
   - `action == "already-done"` → print `message` (artifact locations / resume hint) and **STOP**. Do not run any phase.
   - `action == "run"` → continue the workflow, but **stop after the phase named by `target`** (see the Stop-at checkpoints in Phases 3–6).
   - If Node is unavailable, apply the same rules by hand: invalid value → error; `target` rank ≤ `COMPLETED_STAGE` rank → already-done; otherwise run up to and including `target`. Ranks: research<outline<draft<design<full.
````

- [ ] **Step 8: Run the structure test to verify it passes**

Run: `cd skills/_shared && node --test test/ppt-command.test.js`
Expected: PASS — all 3 structure tests green.

- [ ] **Step 9: Commit**

```bash
git add skills/_shared/scripts/stop-at-cli.js skills/_shared/test/ppt-command.test.js commands/ppt.md
git commit -m "feat(ppt): wire --stop-at parse + decision into Phase 1 (Fusion M1)"
```

---

## Task 4: Phase-boundary stop checkpoints + early delivery

**Files:**
- Modify: `commands/ppt.md` (end of Phases 3, 4, 5, 6; new "Early-delivery" shared block)
- Test: `skills/_shared/test/ppt-command.test.js`

- [ ] **Step 1: Add failing structure tests** — append to `skills/_shared/test/ppt-command.test.js`:

```js
test('each of Phases 3-6 has a stop-at checkpoint', () => {
  const checkpoints = PPT.match(/Stop-at checkpoint/g) || [];
  assert.ok(checkpoints.length >= 4, `expected >=4 stop-at checkpoints, found ${checkpoints.length}`);
});

test('early delivery writes output/README.md with a resume command', () => {
  assert.match(PPT, /output\/README\.md/);
  assert.match(PPT, /--run-id=\$\{CHANGE_ID\}/);
});

test('early-delivery README block documents per-stage artifacts', () => {
  assert.match(PPT, /Early-delivery README/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd skills/_shared && node --test test/ppt-command.test.js`
Expected: FAIL — no "Stop-at checkpoint" / "output/README.md" / "Early-delivery README" yet.

- [ ] **Step 3: Add the shared "Early-delivery README" block to `commands/ppt.md`**

Insert this section immediately **before** "## Phase 7: Delivery (Hard Stop)":

````
## Stop-at: Early delivery (shared)

When a Stop-at checkpoint fires (`action == "run"` and the current phase == `target`),
deliver the partial result and STOP — do **not** continue to the next phase:

1. `mkdir -p "${RUN_DIR}/output"`
2. Copy this stage's artifacts into `output/` (per the **Early-delivery README** table below).
3. Write `${RUN_DIR}/output/README.md` using this template (substitute the bracketed values):

   ```markdown
   # [presentation title] — partial output (stopped at: [target])

   This run stopped at **[target]** (Phase [stopPhase]). Artifacts produced:
   [bullet list of the files copied into output/]

   ## Continue
   Run to completion:
       /ppt-agent:ppt --run-id=${CHANGE_ID} --stop-at=full
   Or stop at the next stage ([nextStage]):
       /ppt-agent:ppt --run-id=${CHANGE_ID} --stop-at=[nextStage]
   ```
   (Omit the "next stage" line when `nextStage` is empty, i.e. for `design`→`full`.)

4. Print `output/README.md`'s resume command to the user and STOP.

**Early-delivery README — per-stage artifacts** (what to copy into `output/`):

| target | copy into output/ |
|--------|-------------------|
| `research` | `research-context.md`, `requirements.md`, `materials.md` |
| `outline` | `outline.json`, `outline-preview.md` |
| `draft` | `drafts/*.svg`, `draft-manifest.json` |
| `design` | `slides/*.svg`, `reviews/*.md`, `review-manifest.json` |
````

- [ ] **Step 4: Add the four checkpoint hooks in `commands/ppt.md`**

At the **end of Phase 3** (after item 3 "Lead serially merges ... materials.md"), append:
```
4. **Stop-at checkpoint (research)**: if `target == "research"`, run "Stop-at: Early delivery (shared)" with `target=research`, then STOP.
```

At the **end of Phase 4** (after item 4 of "Phase 4: Outline Planning"), append:
```
5. **Stop-at checkpoint (outline)**: if `target == "outline"`, run "Stop-at: Early delivery (shared)" with `target=outline`, then STOP.
```

At the **end of Phase 5** (after item 1 of "Phase 5: Planning Draft"), append:
```
2. **Stop-at checkpoint (draft)**: if `target == "draft"`, run "Stop-at: Early delivery (shared)" with `target=draft`, then STOP.
```

At the **end of Phase 6** (after the "Write review manifest" item, just before "## Phase 7"), append:
```
6. **Stop-at checkpoint (design)**: if `target == "design"`, run "Stop-at: Early delivery (shared)" with `target=design`, then STOP. (`full` falls through into Phase 7 unchanged.)
```

- [ ] **Step 5: Run the structure tests to verify they pass**

Run: `cd skills/_shared && node --test test/ppt-command.test.js`
Expected: PASS — checkpoint count ≥ 4, `output/README.md` + resume command present, "Early-delivery README" present.

- [ ] **Step 6: Run the full `_shared` suite (no regressions)**

Run: `cd skills/_shared && node --test`
Expected: PASS — every `stop-at.test.js` and `ppt-command.test.js` test green.

- [ ] **Step 7: Commit**

```bash
git add commands/ppt.md skills/_shared/test/ppt-command.test.js
git commit -m "feat(ppt): add Phase 3-6 stop-at checkpoints + early delivery (Fusion M1)"
```

---

## Task 5: Document the flag

**Files:**
- Modify: `CLAUDE.md` (plugin root, `/Users/kevinchen/PPT_Agent/ppt-agent/CLAUDE.md`)

- [ ] **Step 1: Add a "Workflow Flags" note** under "## Available Commands" in `CLAUDE.md`:

```markdown
### Flags

- `--stop-at=<research|outline|draft|design|full>` — stop the workflow after a chosen stage and deliver the partial result to `${RUN_DIR}/output/` (with a `README.md` resume command). Default `full`. Combine with `--run-id=<id>` to resume a stopped run and continue to a later stage. Decision logic: `skills/_shared/scripts/lib/stop-at.js` (unit-tested).
```

- [ ] **Step 2: Verify the doc references a real path**

Run: `test -f skills/_shared/scripts/lib/stop-at.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(ppt): document --stop-at flag (Fusion M1)"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** stage enum (Task 1) · 5 interaction rules incl. outline-approved hint (Task 2) · flag parse + already-done short-circuit wired into Phase 1 (Task 3) · per-phase stop + early delivery to `output/` + `output/README.md` resume command (Task 4, matches FUSION §2.2) · `--stop-at=full` unchanged (Task 4 Step 4 "`full` falls through ... unchanged"). Acceptance bullets from FUSION §2.3 (`--stop-at=outline` only outline files; `--run-id=xxx --stop-at=full` continues; `--stop-at=full` == current) all map to tasks.
- **Placeholder scan:** every code/prose block is concrete; no TBD/"handle edge cases".
- **Type consistency:** `resolveStopAction` return shape `{action,target,stopPhase,nextStage,message}` is identical across the CLI (Task 3), Phase 1 prose (Task 3 Step 7), and tests (Task 2). Stage vocabulary `research|outline|draft|design|full` identical everywhere.
- **Out of scope (intentional):** persisting `stop_at` into `outline.json` (FUSION line 459 schema is aspirational; the flag is runtime-only); no changes to the existing resume detection beyond reading its result.

---

## Execution Handoff

Plan complete. After approval, two execution options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here with checkpoints.
