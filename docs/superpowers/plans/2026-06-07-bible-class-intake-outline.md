# Bible Class Intake + Lesson Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working `/bible-class` command (Phases 1–2) that reads a Sunday-school lesson plan (教案) from an image or text, writes a validated `lesson-source.json`, calls `content-core` in a new `mode=lesson_outline` to produce a structured `lesson-outline.json` + `lesson-outline.md` + `craft.md`, and hard-stops for teacher approval before continuing. Pure-logic Node.js units for schema validation and craft rendering are fully unit-tested.

**Architecture:** The new `commands/bible-class.md` orchestrates via `Task()` agents and `AskUserQuestion` hard stops, storing all artifacts under `openspec/changes/<run_id>/` (the same RUN_DIR convention as `/ppt`). A new `skills/bible-class/` folder contains two zero-dependency CommonJS modules: `lib/lesson_schema.js` (validates both `lesson-source.json` and `lesson-outline.json`) and `lib/craft_writer.js` (renders `craft.md` text from the outline's `craft` section + `memory_verse`). The agent extension adds `mode=lesson_outline` and `mode=lesson_revise` dispatch blocks to `agents/content-core.md`.

**Tech Stack:** Node.js ≥18 (CommonJS), built-in `node:test` + `node:assert` (no test deps). Mirrors `skills/image-gen/` conventions: `package.json`, `scripts/`, `node --test`. Markdown files (command + agent) are verified with `grep`-based checks, not fake unit tests.

**This is Plan 2 of 4.** It depends on nothing from Plan 1 at runtime — it shares only the RUN_DIR convention (`openspec/changes/<run_id>/`) and does NOT require `skills/image-gen/` to be present. Plans 3–4 (style + master image generation, PPTX assembly) will consume the `lesson-outline.json` produced here.

**Plan-wide conventions:**
- Language: plain CommonJS JS (not TS), zero build step. `node --test` runs directly.
- Run all tests from the skill dir: `cd skills/bible-class`.
- Git branch: `feature/bible-class-intake-outline`.
- Commit after every task.

---

## File Structure

```
commands/
└── bible-class.md                          # new: /bible-class command

agents/
└── content-core.md                         # extend: add mode=lesson_outline + mode=lesson_revise

skills/bible-class/
├── SKILL.md                                # when/how agents use this skill
├── package.json                            # name=bible-class, type=commonjs, test=node --test
└── lib/
    ├── lesson_schema.js                    # validateLessonSource() + validateLessonOutline()
    └── craft_writer.js                     # renderCraftMarkdown(outline) -> string
test/
    ├── lesson_schema.test.js
    └── craft_writer.test.js
```

**Module responsibilities (interfaces locked here):**
- `lesson_schema.validateLessonSource(obj) -> {ok:boolean, errors:string[]}` — checks all required fields, types, enum values.
- `lesson_schema.validateLessonOutline(obj) -> {ok:boolean, errors:string[]}` — checks required fields, `scenes` non-empty, `approved` boolean, craft/memory_verse structure.
- `craft_writer.renderCraftMarkdown(outline) -> string` — renders materials list, steps, relation_to_story, and memory_verse from `outline.craft` + `outline.memory_verse`.

---

## Shared Data Contracts (single source of truth for Plans 2–4)

### `lesson-source.json`
```json
{
  "title": "string",
  "scripture_ref": "string e.g. 约翰福音 6:1-15",
  "material_name": "string (教材名)",
  "age_group": "3-5",
  "core_points": ["string"],
  "raw_text": "string (OCR'd or typed 教案)",
  "source_kind": "image | text"
}
```

### `lesson-outline.json`
```json
{
  "title": "string",
  "approved": false,
  "scripture_ref": "string",
  "teaching": {
    "duration_min": 15,
    "scenes": [
      {
        "index": 1,
        "title": "string",
        "key_message": "string",
        "narration": "string (3-5岁口语旁白)",
        "interaction": "string (互动提问)",
        "image_brief": "string (画面描述，供生图)"
      }
    ]
  },
  "craft": {
    "duration_min": 15,
    "title": "string",
    "materials": ["string"],
    "steps": ["string"],
    "relation_to_story": "string"
  },
  "memory_verse": {
    "text": "string",
    "ref": "string"
  }
}
```

**Rules baked into content-core prompt:**
- Outline content derives ONLY from `lesson-source.json`; do not introduce doctrine beyond the 教材.
- `approved` is always set to `false` by the agent; the lead orchestrator sets it to `true` after user approval.
- `craft.md` is rendered from `lesson-outline.json.craft` + `memory_verse`; it is TEXT ONLY and never becomes a slide.

---

## Task 1: Scaffold the `skills/bible-class/` skill

**Files:**
- Create: `skills/bible-class/package.json`
- Create: `skills/bible-class/test/smoke.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/smoke.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('package.json exists and declares commonjs with correct name', () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(pkg.type, 'commonjs');
  assert.strictEqual(pkg.name, 'bible-class');
  assert.ok(pkg.scripts && pkg.scripts.test, 'scripts.test must exist');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/smoke.test.js`
Expected: FAIL — "package.json must exist".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/package.json`:

```json
{
  "name": "bible-class",
  "version": "0.1.0",
  "description": "Schema validation and craft-markdown rendering for the /bible-class Sunday-school lesson workflow.",
  "type": "commonjs",
  "private": true,
  "scripts": {
    "test": "node --test"
  },
  "license": "ISC"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/smoke.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git checkout -b feature/bible-class-intake-outline
git add skills/bible-class/package.json skills/bible-class/test/smoke.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): scaffold skill package

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lesson_schema.js` — `validateLessonSource`

**Files:**
- Create: `skills/bible-class/lib/lesson_schema.js`
- Test: `skills/bible-class/test/lesson_schema.test.js` (first block)

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/lesson_schema.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateLessonSource } = require('../lib/lesson_schema');

// ── helpers ──────────────────────────────────────────────────────────────────

function validSource() {
  return {
    title: '耶稣喂饱五千人',
    scripture_ref: '约翰福音 6:1-15',
    material_name: '儿童圣经故事教材',
    age_group: '3-5',
    core_points: ['神的供应', '感恩祷告'],
    raw_text: '今天的故事是耶稣用五饼二鱼喂饱了五千人……',
    source_kind: 'image',
  };
}

// ── validateLessonSource ──────────────────────────────────────────────────────

test('validateLessonSource: valid object returns ok=true with no errors', () => {
  const r = validateLessonSource(validSource());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('validateLessonSource: missing title fails with clear error', () => {
  const obj = validSource();
  delete obj.title;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title')), `errors should mention "title": ${r.errors}`);
});

test('validateLessonSource: missing scripture_ref fails', () => {
  const obj = validSource();
  delete obj.scripture_ref;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scripture_ref')));
});

test('validateLessonSource: missing material_name fails', () => {
  const obj = validSource();
  delete obj.material_name;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('material_name')));
});

test('validateLessonSource: missing age_group fails', () => {
  const obj = validSource();
  delete obj.age_group;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('age_group')));
});

test('validateLessonSource: missing core_points fails', () => {
  const obj = validSource();
  delete obj.core_points;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points')));
});

test('validateLessonSource: missing raw_text fails', () => {
  const obj = validSource();
  delete obj.raw_text;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('raw_text')));
});

test('validateLessonSource: missing source_kind fails', () => {
  const obj = validSource();
  delete obj.source_kind;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('source_kind')));
});

test('validateLessonSource: invalid source_kind value fails', () => {
  const obj = validSource();
  obj.source_kind = 'video';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('source_kind') && (e.includes('image') || e.includes('text'))));
});

test('validateLessonSource: core_points not an array fails', () => {
  const obj = validSource();
  obj.core_points = '神的供应';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points') && e.includes('array')));
});

test('validateLessonSource: core_points empty array fails', () => {
  const obj = validSource();
  obj.core_points = [];
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('core_points')));
});

test('validateLessonSource: title not a string fails', () => {
  const obj = validSource();
  obj.title = 42;
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title') && e.includes('string')));
});

test('validateLessonSource: null input fails gracefully', () => {
  const r = validateLessonSource(null);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateLessonSource: source_kind=text is valid', () => {
  const obj = validSource();
  obj.source_kind = 'text';
  const r = validateLessonSource(obj);
  assert.strictEqual(r.ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/lesson_schema.test.js`
Expected: FAIL — "Cannot find module '../lib/lesson_schema'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/lesson_schema.js`:

```js
'use strict';

// ─── lesson-source.json validator ────────────────────────────────────────────

const SOURCE_STRING_FIELDS = ['title', 'scripture_ref', 'material_name', 'age_group', 'raw_text'];
const SOURCE_KIND_VALUES = ['image', 'text'];

/**
 * Validate a parsed lesson-source.json object.
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateLessonSource(obj) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('lesson-source: input must be a non-null object');
    return { ok: false, errors };
  }

  // Required string fields
  for (const field of SOURCE_STRING_FIELDS) {
    if (!(field in obj)) {
      errors.push(`lesson-source: required field "${field}" is missing`);
    } else if (typeof obj[field] !== 'string') {
      errors.push(`lesson-source: field "${field}" must be a string, got ${typeof obj[field]}`);
    } else if (!obj[field].trim()) {
      errors.push(`lesson-source: field "${field}" must not be empty`);
    }
  }

  // core_points: non-empty string array
  if (!('core_points' in obj)) {
    errors.push('lesson-source: required field "core_points" is missing');
  } else if (!Array.isArray(obj.core_points)) {
    errors.push('lesson-source: field "core_points" must be an array');
  } else if (obj.core_points.length === 0) {
    errors.push('lesson-source: field "core_points" must contain at least one item');
  }

  // source_kind: enum
  if (!('source_kind' in obj)) {
    errors.push('lesson-source: required field "source_kind" is missing');
  } else if (!SOURCE_KIND_VALUES.includes(obj.source_kind)) {
    errors.push(
      `lesson-source: field "source_kind" must be one of [${SOURCE_KIND_VALUES.join(', ')}], got "${obj.source_kind}"`
    );
  }

  return { ok: errors.length === 0, errors };
}

// ─── lesson-outline.json validator ───────────────────────────────────────────

const OUTLINE_TOP_STRING_FIELDS = ['title', 'scripture_ref'];

/**
 * Validate a parsed lesson-outline.json object.
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateLessonOutline(obj) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('lesson-outline: input must be a non-null object');
    return { ok: false, errors };
  }

  // Required top-level string fields
  for (const field of OUTLINE_TOP_STRING_FIELDS) {
    if (!(field in obj)) {
      errors.push(`lesson-outline: required field "${field}" is missing`);
    } else if (typeof obj[field] !== 'string') {
      errors.push(`lesson-outline: field "${field}" must be a string, got ${typeof obj[field]}`);
    } else if (!obj[field].trim()) {
      errors.push(`lesson-outline: field "${field}" must not be empty`);
    }
  }

  // approved: must be a boolean
  if (!('approved' in obj)) {
    errors.push('lesson-outline: required field "approved" is missing');
  } else if (typeof obj.approved !== 'boolean') {
    errors.push(`lesson-outline: field "approved" must be a boolean, got ${typeof obj.approved}`);
  }

  // teaching block
  if (!('teaching' in obj) || obj.teaching === null || typeof obj.teaching !== 'object') {
    errors.push('lesson-outline: required field "teaching" is missing or not an object');
  } else {
    const t = obj.teaching;
    if (typeof t.duration_min !== 'number') {
      errors.push('lesson-outline: teaching.duration_min must be a number');
    }
    if (!Array.isArray(t.scenes)) {
      errors.push('lesson-outline: teaching.scenes must be an array');
    } else if (t.scenes.length === 0) {
      errors.push('lesson-outline: teaching.scenes must contain at least one scene');
    } else {
      t.scenes.forEach((scene, i) => {
        const prefix = `lesson-outline: teaching.scenes[${i}]`;
        if (typeof scene !== 'object' || scene === null) {
          errors.push(`${prefix} must be an object`);
          return;
        }
        for (const sf of ['title', 'key_message', 'narration', 'interaction', 'image_brief']) {
          if (!(sf in scene)) {
            errors.push(`${prefix}.${sf} is required`);
          } else if (typeof scene[sf] !== 'string') {
            errors.push(`${prefix}.${sf} must be a string`);
          }
        }
        if (typeof scene.index !== 'number') {
          errors.push(`${prefix}.index must be a number`);
        }
      });
    }
  }

  // craft block
  if (!('craft' in obj) || obj.craft === null || typeof obj.craft !== 'object') {
    errors.push('lesson-outline: required field "craft" is missing or not an object');
  } else {
    const c = obj.craft;
    if (typeof c.duration_min !== 'number') {
      errors.push('lesson-outline: craft.duration_min must be a number');
    }
    if (typeof c.title !== 'string' || !c.title.trim()) {
      errors.push('lesson-outline: craft.title must be a non-empty string');
    }
    if (!Array.isArray(c.materials)) {
      errors.push('lesson-outline: craft.materials must be an array');
    } else if (c.materials.length === 0) {
      errors.push('lesson-outline: craft.materials must contain at least one item');
    }
    if (!Array.isArray(c.steps)) {
      errors.push('lesson-outline: craft.steps must be an array');
    } else if (c.steps.length === 0) {
      errors.push('lesson-outline: craft.steps must contain at least one step');
    }
    if (typeof c.relation_to_story !== 'string' || !c.relation_to_story.trim()) {
      errors.push('lesson-outline: craft.relation_to_story must be a non-empty string');
    }
  }

  // memory_verse block
  if (!('memory_verse' in obj) || obj.memory_verse === null || typeof obj.memory_verse !== 'object') {
    errors.push('lesson-outline: required field "memory_verse" is missing or not an object');
  } else {
    for (const vf of ['text', 'ref']) {
      if (typeof obj.memory_verse[vf] !== 'string' || !obj.memory_verse[vf].trim()) {
        errors.push(`lesson-outline: memory_verse.${vf} must be a non-empty string`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateLessonSource, validateLessonOutline };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/lesson_schema.test.js`
Expected: PASS (14 tests for validateLessonSource).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/lesson_schema.js skills/bible-class/test/lesson_schema.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): validateLessonSource with full field/type/enum coverage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `lesson_schema.js` — `validateLessonOutline`

**Files:**
- Extend test: `skills/bible-class/test/lesson_schema.test.js` (second block)
- `lesson_schema.js` was already written in Task 2 (includes `validateLessonOutline`)

- [ ] **Step 1: Write the failing test**

Append to `skills/bible-class/test/lesson_schema.test.js`:

```js
const { validateLessonOutline } = require('../lib/lesson_schema');

// ── helpers ───────────────────────────────────────────────────────────────────

function validOutline() {
  return {
    title: '耶稣喂饱五千人',
    approved: false,
    scripture_ref: '约翰福音 6:1-15',
    teaching: {
      duration_min: 15,
      scenes: [
        {
          index: 1,
          title: '小男孩带来午餐',
          key_message: '神能用小的东西做大事',
          narration: '有一天，一个小男孩带来了五个饼和两条鱼……',
          interaction: '你有没有带过零食分享给朋友？',
          image_brief: '小男孩微笑着将篮子递给耶稣，周围有很多小朋友',
        },
      ],
    },
    craft: {
      duration_min: 15,
      title: '五饼二鱼手工',
      materials: ['彩色纸', '剪刀', '胶水'],
      steps: ['剪出鱼形', '剪出圆形饼', '粘贴到画面'],
      relation_to_story: '用手工重温故事，体会神的供应',
    },
    memory_verse: {
      text: '耶稣说：你们来，你们自己暗暗地到旷野地方去歇一歇。',
      ref: '马可福音 6:31',
    },
  };
}

// ── validateLessonOutline ─────────────────────────────────────────────────────

test('validateLessonOutline: valid object returns ok=true with no errors', () => {
  const r = validateLessonOutline(validOutline());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('validateLessonOutline: missing title fails', () => {
  const obj = validOutline();
  delete obj.title;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('title')));
});

test('validateLessonOutline: missing scripture_ref fails', () => {
  const obj = validOutline();
  delete obj.scripture_ref;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scripture_ref')));
});

test('validateLessonOutline: approved not a boolean fails', () => {
  const obj = validOutline();
  obj.approved = 'yes';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('approved') && e.includes('boolean')));
});

test('validateLessonOutline: approved missing fails', () => {
  const obj = validOutline();
  delete obj.approved;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('approved')));
});

test('validateLessonOutline: missing teaching block fails', () => {
  const obj = validOutline();
  delete obj.teaching;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('teaching')));
});

test('validateLessonOutline: empty scenes array fails', () => {
  const obj = validOutline();
  obj.teaching.scenes = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scenes') && e.includes('at least one')));
});

test('validateLessonOutline: scenes not an array fails', () => {
  const obj = validOutline();
  obj.teaching.scenes = 'not-array';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('scenes') && e.includes('array')));
});

test('validateLessonOutline: scene missing image_brief fails', () => {
  const obj = validOutline();
  delete obj.teaching.scenes[0].image_brief;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('image_brief')));
});

test('validateLessonOutline: scene missing narration fails', () => {
  const obj = validOutline();
  delete obj.teaching.scenes[0].narration;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('narration')));
});

test('validateLessonOutline: scene index not a number fails', () => {
  const obj = validOutline();
  obj.teaching.scenes[0].index = '1';
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('index') && e.includes('number')));
});

test('validateLessonOutline: missing craft block fails', () => {
  const obj = validOutline();
  delete obj.craft;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('craft')));
});

test('validateLessonOutline: craft with empty materials fails', () => {
  const obj = validOutline();
  obj.craft.materials = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('materials')));
});

test('validateLessonOutline: craft with empty steps fails', () => {
  const obj = validOutline();
  obj.craft.steps = [];
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('steps')));
});

test('validateLessonOutline: missing memory_verse fails', () => {
  const obj = validOutline();
  delete obj.memory_verse;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('memory_verse')));
});

test('validateLessonOutline: memory_verse missing ref fails', () => {
  const obj = validOutline();
  delete obj.memory_verse.ref;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('memory_verse') && e.includes('ref')));
});

test('validateLessonOutline: null input fails gracefully', () => {
  const r = validateLessonOutline(null);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateLessonOutline: approved=true is valid (lead sets this after approval)', () => {
  const obj = validOutline();
  obj.approved = true;
  const r = validateLessonOutline(obj);
  assert.strictEqual(r.ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/lesson_schema.test.js`
Expected: FAIL on the new tests — "validateLessonOutline is not a function" (it hasn't been required yet) or the tests just fail because the second `require` block is outside the test file's initial scope. (In practice the file already exports `validateLessonOutline` from Task 2, so the tests will fail only if the implementation has bugs — confirm by running and inspecting output.)

> Note: Because `lesson_schema.js` was written complete in Task 2, Step 2 here validates that all `validateLessonOutline` tests pass end-to-end. If any fail, fix `lesson_schema.js` and re-run before committing.

- [ ] **Step 3: Verify implementation is complete (no new impl needed)**

`validateLessonOutline` was delivered in full in Task 2's `lesson_schema.js`. No additional implementation file changes are needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/lesson_schema.test.js`
Expected: PASS (all tests including the 18 new `validateLessonOutline` tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/test/lesson_schema.test.js
git commit -m "$(cat <<'EOF'
test(bible-class): validateLessonOutline full coverage (scenes, craft, memory_verse)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `craft_writer.js` — `renderCraftMarkdown`

**Files:**
- Create: `skills/bible-class/lib/craft_writer.js`
- Create: `skills/bible-class/test/craft_writer.test.js`

- [ ] **Step 1: Write the failing test**

Create `skills/bible-class/test/craft_writer.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { renderCraftMarkdown } = require('../lib/craft_writer');

function outline() {
  return {
    title: '耶稣喂饱五千人',
    craft: {
      duration_min: 15,
      title: '五饼二鱼手工',
      materials: ['彩色纸', '剪刀', '胶水'],
      steps: ['剪出鱼形', '剪出圆形饼', '粘贴到画面上'],
      relation_to_story: '用手工重温故事，体会神的供应',
    },
    memory_verse: {
      text: '我靠着那加给我力量的，凡事都能做。',
      ref: '腓立比书 4:13',
    },
  };
}

test('renderCraftMarkdown returns a string', () => {
  const md = renderCraftMarkdown(outline());
  assert.strictEqual(typeof md, 'string');
  assert.ok(md.length > 0);
});

test('renderCraftMarkdown includes craft title as a heading', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /五饼二鱼手工/);
});

test('renderCraftMarkdown includes all materials', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /彩色纸/);
  assert.match(md, /剪刀/);
  assert.match(md, /胶水/);
});

test('renderCraftMarkdown includes all steps', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /剪出鱼形/);
  assert.match(md, /剪出圆形饼/);
  assert.match(md, /粘贴到画面上/);
});

test('renderCraftMarkdown includes relation_to_story text', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /体会神的供应/);
});

test('renderCraftMarkdown includes memory verse text and ref', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /我靠着那加给我力量的/);
  assert.match(md, /腓立比书 4:13/);
});

test('renderCraftMarkdown includes duration information', () => {
  const md = renderCraftMarkdown(outline());
  assert.match(md, /15/);
});

test('renderCraftMarkdown uses list format for materials (dash or number)', () => {
  const md = renderCraftMarkdown(outline());
  // Each material should appear after a list marker line
  const lines = md.split('\n');
  const materialLines = lines.filter(l => l.includes('彩色纸') || l.includes('剪刀') || l.includes('胶水'));
  assert.ok(materialLines.length >= 3, 'each material should appear on its own line');
  // at least one has a list marker
  const hasListMarker = materialLines.some(l => /^[-*\d]/.test(l.trim()));
  assert.ok(hasListMarker, 'materials should use list-style formatting');
});

test('renderCraftMarkdown uses list format for steps', () => {
  const md = renderCraftMarkdown(outline());
  const lines = md.split('\n');
  const stepLines = lines.filter(l => l.includes('剪出鱼形'));
  assert.ok(stepLines.length >= 1);
  const hasListMarker = stepLines.some(l => /^[-*\d]/.test(l.trim()));
  assert.ok(hasListMarker, 'steps should use list-style formatting');
});

test('renderCraftMarkdown throws when craft field is missing', () => {
  const obj = outline();
  delete obj.craft;
  assert.throws(() => renderCraftMarkdown(obj), /craft/);
});

test('renderCraftMarkdown throws when memory_verse field is missing', () => {
  const obj = outline();
  delete obj.memory_verse;
  assert.throws(() => renderCraftMarkdown(obj), /memory_verse/);
});

test('renderCraftMarkdown handles multiple materials and steps (boundary: 5 items)', () => {
  const obj = outline();
  obj.craft.materials = ['纸', '笔', '剪刀', '胶水', '彩带'];
  obj.craft.steps = ['步骤一', '步骤二', '步骤三', '步骤四', '步骤五'];
  const md = renderCraftMarkdown(obj);
  for (const m of obj.craft.materials) assert.match(md, new RegExp(m));
  for (const s of obj.craft.steps) assert.match(md, new RegExp(s));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/craft_writer.test.js`
Expected: FAIL — "Cannot find module '../lib/craft_writer'".

- [ ] **Step 3: Write minimal implementation**

Create `skills/bible-class/lib/craft_writer.js`:

```js
'use strict';

/**
 * Render craft.md text from a lesson-outline.json object.
 * craft.md is TEXT ONLY — it is never a slide.
 *
 * @param {{ craft: object, memory_verse: object, title?: string }} outline
 * @returns {string}
 */
function renderCraftMarkdown(outline) {
  if (!outline || typeof outline !== 'object') {
    throw new Error('renderCraftMarkdown: outline must be a non-null object');
  }
  if (!outline.craft || typeof outline.craft !== 'object') {
    throw new Error('renderCraftMarkdown: outline.craft is required');
  }
  if (!outline.memory_verse || typeof outline.memory_verse !== 'object') {
    throw new Error('renderCraftMarkdown: outline.memory_verse is required');
  }

  const { craft, memory_verse } = outline;
  const lessonTitle = outline.title ? `《${outline.title}》` : '';

  const materialsList = (craft.materials || [])
    .map((m, i) => `- ${m}`)
    .join('\n');

  const stepsList = (craft.steps || [])
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  return `# 手工活动：${craft.title || ''}

**课程：** ${lessonTitle}
**时间：** ${craft.duration_min || 15} 分钟

## 所需材料

${materialsList}

## 制作步骤

${stepsList}

## 与故事的联系

${craft.relation_to_story || ''}

---

## 本课金句

> ${memory_verse.text || ''}
>
> ——${memory_verse.ref || ''}
`.trimEnd() + '\n';
}

module.exports = { renderCraftMarkdown };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test test/craft_writer.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test`
Expected: PASS — all tests across `smoke`, `lesson_schema`, `craft_writer` green.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/craft_writer.js skills/bible-class/test/craft_writer.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): craft_writer renderCraftMarkdown with materials/steps/memory_verse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `skills/bible-class/SKILL.md`

**Files:**
- Create: `skills/bible-class/SKILL.md`

- [ ] **Step 1: Write the file**

Create `skills/bible-class/SKILL.md`:

```markdown
---
name: bible-class
description: >
  Schema validation and craft-markdown rendering for the /bible-class Sunday-school lesson
  workflow. Use when validating lesson-source.json or lesson-outline.json objects, or when
  rendering a craft.md file from a completed lesson outline.
---

# bible-class skill

## When to use
- Validate a `lesson-source.json` object before writing to RUN_DIR (call `validateLessonSource`).
- Validate a `lesson-outline.json` object after content-core produces it (call `validateLessonOutline`).
- Render `craft.md` text from a finalized `lesson-outline.json` (call `renderCraftMarkdown`).

## Modules

### `lib/lesson_schema.js`

```js
const { validateLessonSource, validateLessonOutline } = require('./lib/lesson_schema');

// Returns { ok: boolean, errors: string[] }
const r = validateLessonSource(lessonSourceObj);
if (!r.ok) throw new Error(r.errors.join('\n'));

const r2 = validateLessonOutline(lessonOutlineObj);
if (!r2.ok) throw new Error(r2.errors.join('\n'));
```

### `lib/craft_writer.js`

```js
const { renderCraftMarkdown } = require('./lib/craft_writer');
const craftText = renderCraftMarkdown(lessonOutlineObj);
// craftText is a Markdown string: craft title, materials list, steps, relation_to_story, memory_verse.
// Write it to ${RUN_DIR}/craft.md.
```

## Data contract references
- `lesson-source.json` schema: see `commands/bible-class.md` §Schema.
- `lesson-outline.json` schema: see `commands/bible-class.md` §Schema.
- Theology rule: outline content must derive ONLY from `lesson-source.json`; do not introduce
  doctrine beyond the 教材. Enforced in `agents/content-core.md` mode=lesson_outline.
```

- [ ] **Step 2: Verify file exists**

Run: `ls /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/SKILL.md`
Expected: file listed.

- [ ] **Step 3: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/SKILL.md
git commit -m "$(cat <<'EOF'
docs(bible-class): SKILL.md with module usage and data contract references

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extend `agents/content-core.md` with `mode=lesson_outline` and `mode=lesson_revise`

**Files:**
- Modify: `agents/content-core.md`

This task adds prose/structure to the existing agent file. Because agent `.md` files are read by Claude at runtime (not executed as code), we use `grep`-based verification steps instead of unit tests.

- [ ] **Step 1: Review existing file**

Run: `grep -n "mode=" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md`
Expected: lines showing `mode`: `outline` | `revise` | `draft`. Confirm `lesson_outline` is NOT yet present.

- [ ] **Step 2: Add `lesson_outline` and `lesson_revise` to the Inputs mode list**

In `agents/content-core.md`, find:

```
- `mode`: `outline` | `revise` | `draft`
```

Replace with:

```
- `mode`: `outline` | `revise` | `draft` | `lesson_outline` | `lesson_revise`
```

- [ ] **Step 3: Add outputs for the new modes**

In `agents/content-core.md`, find the Outputs block:

```
- `mode=outline`: `${run_dir}/outline.json` + `${run_dir}/outline-preview.md`
- `mode=revise`: updated `${run_dir}/outline.json` + `${run_dir}/outline-preview.md`
- `mode=draft`: `${run_dir}/drafts/slide-{nn}.svg` + `${run_dir}/draft-manifest.json`
```

Replace with:

```
- `mode=outline`: `${run_dir}/outline.json` + `${run_dir}/outline-preview.md`
- `mode=revise`: updated `${run_dir}/outline.json` + `${run_dir}/outline-preview.md`
- `mode=draft`: `${run_dir}/drafts/slide-{nn}.svg` + `${run_dir}/draft-manifest.json`
- `mode=lesson_outline`: `${run_dir}/lesson-outline.json` + `${run_dir}/lesson-outline.md` + `${run_dir}/craft.md`
- `mode=lesson_revise`: updated `${run_dir}/lesson-outline.json` + `${run_dir}/lesson-outline.md` + `${run_dir}/craft.md`
```

- [ ] **Step 4: Add the `lesson_outline` and `lesson_revise` dispatch blocks to the Execution section**

In `agents/content-core.md`, find the line:

```
   - `draft`:
```

Add the following two new mode blocks immediately before that line (preserving the exact indentation used in the file):

```
   - `lesson_outline`:
     - Read `${run_dir}/lesson-source.json`. This is the SOLE content source — all outline
       content must derive from it. Do NOT introduce theological positions, extra Bible
       passages, or doctrinal commentary beyond what is stated in lesson-source.json.
     - Generate `lesson-outline.json` with the following exact structure:
       - `title`: lesson title from lesson-source.json.
       - `approved`: always set to `false` (the lead orchestrator sets it to `true` after
         user approval).
       - `scripture_ref`: from lesson-source.json.
       - `teaching.duration_min`: 15.
       - `teaching.scenes`: Array of 4-8 scene objects derived from `core_points` and
         `raw_text`. Each scene:
         - `index`: 1-based integer.
         - `title`: short Chinese scene title (≤12 characters).
         - `key_message`: the single theological truth for this scene, in one sentence,
           derived ONLY from lesson-source.json.
         - `narration`: 2-3 sentences of spoken narration in 3-5岁口语 (simple vocabulary,
           concrete images, no abstract theology). Max 60 characters per sentence.
         - `interaction`: one interactive question or action prompt for children.
         - `image_brief`: a vivid illustration description for image generation (subject,
           setting, mood, key visual elements; max 80 characters).
       - `craft.duration_min`: 15.
       - `craft.title`: short Chinese craft activity name.
       - `craft.materials`: list of simple craft materials (paper, scissors, glue, etc.).
       - `craft.steps`: numbered steps for the craft activity.
       - `craft.relation_to_story`: one sentence connecting the craft to the Bible story.
       - `memory_verse.text`: a short, age-appropriate Bible verse from lesson-source.json
         scripture_ref or a verse cited in raw_text.
       - `memory_verse.ref`: book/chapter:verse citation.
     - Validate the generated JSON with `skills/bible-class/lib/lesson_schema.js`
       `validateLessonOutline`. If validation fails, fix and re-validate before writing.
     - Write `${run_dir}/lesson-outline.json`.
     - Generate `${run_dir}/lesson-outline.md`: a human-readable markdown summary of the
       outline. Format:
       - Lesson title and scripture ref as heading.
       - One section per scene (index, title, key_message, narration preview, image_brief).
       - Craft section listing title, materials, and steps.
       - Memory verse section.
     - Generate `${run_dir}/craft.md` by calling `skills/bible-class/lib/craft_writer.js`
       `renderCraftMarkdown(outlineObj)` on the finalized outline. Write the returned
       string to `${run_dir}/craft.md`. craft.md is TEXT ONLY — it never becomes a slide.
     - Send `lesson_outline_ready` to lead.

   - `lesson_revise`:
     - Read existing `${run_dir}/lesson-outline.json` as the baseline.
     - Parse `feedback` from prompt args — this is the teacher's modification instruction.
     - Apply incremental changes to the existing outline:
       - Do NOT regenerate scenes that were not mentioned in the feedback.
       - Do NOT introduce content not present in `lesson-source.json`.
       - Re-index `teaching.scenes` sequentially after any add/remove operations.
     - Re-validate with `validateLessonOutline` before writing.
     - Write updated `${run_dir}/lesson-outline.json`.
     - Regenerate `${run_dir}/lesson-outline.md` and `${run_dir}/craft.md` from the
       updated outline.
     - Send `lesson_outline_ready` to lead.

```

- [ ] **Step 5: Verify the mode dispatch blocks are present**

Run the following grep checks:

```bash
grep -n "lesson_outline" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
grep -n "lesson_revise" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
grep -n "lesson_outline_ready" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
grep -n "validateLessonOutline" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
grep -n "craft_writer" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
grep -n "approved.*false" /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
```

Expected: each grep returns at least one matching line. If any returns empty, the corresponding step was not applied correctly.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add agents/content-core.md
git commit -m "$(cat <<'EOF'
feat(content-core): add mode=lesson_outline and mode=lesson_revise dispatch blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create `commands/bible-class.md` (Phases 1–2)

**Files:**
- Create: `commands/bible-class.md`

- [ ] **Step 1: Write the file**

Create `commands/bible-class.md`:

```markdown
---
description: "Sunday-school Bible lesson workflow: lesson intake (教案 image/text) → lesson outline → hard-stop approval → (Phases 3-6 continue in Plans 3-4)"
argument-hint: "[--run-id=<id>] [--age-group=3-5] <lesson-image-path-or-topic>"
allowed-tools:
  - Task
  - AskUserQuestion
  - Read
  - Write
  - Bash
---

# /bible-class

## Purpose

Generate a Sunday-school lesson package for 3-5 year-olds from a teacher's 教案 (lesson plan
image or typed text). Phases 1–2 deliver a validated lesson outline and craft activity for
teacher approval before any images are generated.

## Agent Types

- `ppt-agent:content-core` (mode=lesson_outline, mode=lesson_revise)

## Schema (single source of truth for Plans 2–4)

### lesson-source.json

```json
{
  "title": "string",
  "scripture_ref": "string e.g. 约翰福音 6:1-15",
  "material_name": "string (教材名)",
  "age_group": "3-5",
  "core_points": ["string"],
  "raw_text": "string (OCR'd or typed 教案)",
  "source_kind": "image | text"
}
```

### lesson-outline.json

```json
{
  "title": "string",
  "approved": false,
  "scripture_ref": "string",
  "teaching": {
    "duration_min": 15,
    "scenes": [
      {
        "index": 1,
        "title": "string",
        "key_message": "string",
        "narration": "string (3-5岁口语旁白)",
        "interaction": "string (互动提问)",
        "image_brief": "string (画面描述，供生图)"
      }
    ]
  },
  "craft": {
    "duration_min": 15,
    "title": "string",
    "materials": ["string"],
    "steps": ["string"],
    "relation_to_story": "string"
  },
  "memory_verse": {
    "text": "string",
    "ref": "string"
  }
}
```

## Required Artifacts

- `${RUN_DIR}/input.md`
- `${RUN_DIR}/lesson-source.json`
- `${RUN_DIR}/lesson-outline.json`
- `${RUN_DIR}/lesson-outline.md`
- `${RUN_DIR}/craft.md`

## Phase 1: Init + Lesson Intake

1. Parse flags: `--run-id` (optional resume), `--age-group` (default: `3-5`).
2. Extract the lesson argument: this is either an image file path (ends in `.jpg`, `.jpeg`,
   `.png`, `.webp`) or a text string describing the lesson topic.

3. Resolve run id:

   ```bash
   if [[ -n "${RUN_ID_ARG}" ]]; then
     CHANGE_ID="${RUN_ID_ARG}"
   else
     # Derive from lesson topic slug, prefix with "bc-" to distinguish from /ppt runs
     CHANGE_ID="bc-${slug_from_topic}"
     # Fallback: bc-$(date +%Y%m%d-%H%M%S)
   fi
   RUN_DIR="openspec/changes/${CHANGE_ID}"
   mkdir -p "${RUN_DIR}"
   ```

4. **Resume detection** (when `--run-id` is provided):
   - `lesson-outline.json` with `"approved": true` → skip to Phase 3 (Plans 3–4, not yet
     implemented; inform user and stop).
   - `lesson-outline.json` with `"approved": false` → re-enter Phase 2 Hard Stop.
   - `lesson-source.json` exists but no `lesson-outline.json` → resume at Phase 2.
   - Nothing exists → start from Phase 1.

5. **Read the lesson plan (教案)**:

   **If input is an image file path:**
   - Use Claude's vision capability to read the image directly.
   - Extract: lesson title, scripture reference (book, chapter, verse range), teaching
     material name (教材名), age group, core teaching points (核心要点), and full raw text.
   - If the image is unclear or key fields cannot be read, call `AskUserQuestion` to ask
     the teacher to provide the missing information as text.

   **If input is text:**
   - Parse the text to extract the same fields.
   - If core fields (scripture_ref, core_points) are absent, call `AskUserQuestion` to
     ask the teacher for them.

6. **Write `${RUN_DIR}/input.md`** with: run id, input type (image/text), age group flag,
   original argument.

7. **Validate and write `${RUN_DIR}/lesson-source.json`**:
   - Construct the object with all required fields.
   - Validate with `skills/bible-class/lib/lesson_schema.js` `validateLessonSource`.
   - If validation fails, call `AskUserQuestion` listing the missing fields and ask the
     teacher to supply them. Retry until valid.
   - Write valid JSON to `${RUN_DIR}/lesson-source.json`.

8. **Confirm intake** with `AskUserQuestion` showing the parsed lesson-source fields:
   ```
   已解析教案 — 请确认：
   📖 经文：{scripture_ref}
   📚 教材：{material_name}
   👶 年龄：{age_group}
   🎯 核心要点：{core_points joined by "、"}
   ---
   内容正确吗？回复"是"继续，或告诉我需要修改的地方。
   ```
   If the teacher requests changes, update `lesson-source.json` accordingly and re-validate.
   Do NOT proceed to Phase 2 until the teacher confirms.

## Phase 2: Lesson Outline (Hard Stop)

1. Run outline generation:
   ```text
   Task(subagent_type="ppt-agent:content-core",
        prompt="run_dir=${RUN_DIR} mode=lesson_outline")
   ```
   Agent reads `lesson-source.json`, generates `lesson-outline.json` (with `approved:false`)
   + `lesson-outline.md` + `craft.md`. All content derives ONLY from `lesson-source.json`.

2. **MANDATORY Hard Stop**: Call `AskUserQuestion` to present the outline for teacher review.
   Display `lesson-outline.md` in full, then ask:
   ```
   📋 课程大纲已生成 — 请审阅：

   {contents of lesson-outline.md}

   ---
   ✂️ 手工活动预览（完整内容见 craft.md）：
   {craft.title} — {craft.duration_min}分钟
   材料：{craft.materials joined by "、"}

   ---
   请选择：
   A) 批准大纲，进入下一阶段
   B) 修改大纲（请描述需要修改的地方）
   ```
   Do NOT proceed until the teacher approves.

3. **If teacher requests revisions**, call content-core in revise mode:
   ```text
   Task(subagent_type="ppt-agent:content-core",
        prompt="run_dir=${RUN_DIR} mode=lesson_revise feedback=${TEACHER_FEEDBACK}")
   ```
   Re-present the updated `lesson-outline.md` for approval. Repeat until approved.

4. **After teacher approves**: Set `"approved": true` in `lesson-outline.json`.
   Use the atomic write protocol:
   ```bash
   # Write to temp, validate, then rename
   python3 -c "
   import json, sys
   with open(sys.argv[1]) as f:
       obj = json.load(f)
   obj['approved'] = True
   tmp = sys.argv[1] + '.tmp'
   with open(tmp, 'w') as f:
       json.dump(obj, f, ensure_ascii=False, indent=2)
   json.load(open(tmp))  # validate
   import os; os.rename(tmp, sys.argv[1])
   " "${RUN_DIR}/lesson-outline.json"
   ```

5. **Print Phase 2 completion summary**:
   ```
   ✅ 课程大纲已批准
   📄 大纲文件：${RUN_DIR}/lesson-outline.json
   📄 可读大纲：${RUN_DIR}/lesson-outline.md
   ✂️  手工说明：${RUN_DIR}/craft.md
   ---
   下一步：运行 /bible-class --run-id=${CHANGE_ID} 继续（Phase 3: 风格选择 + 主体生图）
   恢复命令：/bible-class --run-id=${CHANGE_ID}
   ```

## Fallback Rules

- If vision reading fails entirely, fall back to asking the teacher to type the lesson
  content as text. Do not abort.
- If `validateLessonSource` fails after two user correction rounds, show all errors
  clearly and wait for the teacher to fix them. Do not write invalid JSON.
- If content-core returns a `lesson-outline.json` that fails `validateLessonOutline`,
  re-run `mode=lesson_outline` once. If it fails again, surface the validation errors
  to the teacher and stop.
- The `approved` field in `lesson-outline.json` is never set by content-core (it always
  writes `false`). The lead orchestrator is the only writer of `approved: true`.
```

- [ ] **Step 2: Verify structural requirements with grep**

Run the following checks:

```bash
# Hard-stop AskUserQuestion blocks are present
grep -n "AskUserQuestion" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# lesson_outline mode dispatch is referenced
grep -n "mode=lesson_outline" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# lesson_revise mode is referenced
grep -n "mode=lesson_revise" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# RUN_DIR convention matches ppt.md
grep -n "openspec/changes" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# approved:true atomic write is present
grep -n "approved.*True\|approved.*true" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# validateLessonSource is referenced
grep -n "validateLessonSource" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# resume detection block present
grep -n "resume\|run-id\|CHANGE_ID" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md

# lesson-source.json schema present in file
grep -n "lesson-source.json" /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md
```

Expected: each grep returns at least one matching line. If any returns empty, the
corresponding structural element is missing — fix `commands/bible-class.md` before committing.

- [ ] **Step 3: Commit**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add commands/bible-class.md
git commit -m "$(cat <<'EOF'
feat(bible-class): commands/bible-class.md Phases 1-2 (intake + outline hard-stop)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full suite run + final verification

This task confirms that all testable units pass and all markdown files have the required structural elements.

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class && node --test
```

Expected output: all tests pass. Minimum counts:
- `smoke.test.js`: 1 test
- `lesson_schema.test.js`: 32 tests (14 validateLessonSource + 18 validateLessonOutline)
- `craft_writer.test.js`: 12 tests

Total: ≥ 45 tests, 0 failures.

- [ ] **Step 2: Confirm content-core.md has all required elements**

```bash
grep -c "lesson_outline\|lesson_revise\|lesson_outline_ready\|validateLessonOutline\|craft_writer\|SOLE content source" \
  /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md
```

Expected: count ≥ 6 (one match per term).

- [ ] **Step 3: Confirm bible-class.md has all required elements**

```bash
grep -c "AskUserQuestion\|mode=lesson_outline\|mode=lesson_revise\|openspec/changes\|approved.*[Tt]rue\|validateLessonSource\|lesson-source.json\|lesson-outline.json" \
  /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md
```

Expected: count ≥ 8.

- [ ] **Step 4: Confirm no placeholder text remains in any file**

```bash
grep -rn "TODO\|FIXME\|TBD\|<placeholder>\|INSERT_HERE\|\.\.\." \
  /Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/ \
  /Users/kevinchen/PPT_Agent/ppt-agent/commands/bible-class.md \
  /Users/kevinchen/PPT_Agent/ppt-agent/agents/content-core.md \
  2>/dev/null | grep -v "\.test\.js:.*\.\.\." || echo "No placeholders found"
```

Expected: "No placeholders found" or only matches inside code strings that are literal `...` in JavaScript (not placeholders).

- [ ] **Step 5: Commit final verification pass**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git commit --allow-empty -m "$(cat <<'EOF'
chore(bible-class): verified full test suite passes, no placeholders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

### Spec Coverage

| Design spec requirement | Covered? | Notes |
|---|---|---|
| §2.2 Phase 1: 教案 image or text → `lesson-source.json` | Yes | Task 7 `commands/bible-class.md` Phase 1 |
| §2.2 Phase 1: Claude vision for image input | Yes | Described in Phase 1, Step 5 |
| §2.2 Phase 1: degraded to text if image unclear | Yes | Fallback Rules block |
| §2.2 Phase 2: `content-core` new mode `lesson_outline` | Yes | Task 6 extends `agents/content-core.md` |
| §2.2 Phase 2: Hard-stop with `AskUserQuestion` | Yes | Task 7 Phase 2, Step 2 |
| §2.2 Phase 2: `revise` mode + iterative loop | Yes | Task 7 Phase 2, Step 3; Task 6 `mode=lesson_revise` |
| §2.2 Phase 2: `approved:true` gate (mirrors ppt outline.json) | Yes | Task 7 Phase 2, Step 4 |
| §2.3 RUN_DIR `openspec/changes/<run_id>/` | Yes | Task 7 Phase 1, Step 3 |
| §2.3 Artifacts: `lesson-source.json`, `lesson-outline.json`, `lesson-outline.md`, `craft.md` | Yes | Tasks 6, 7 |
| §2.7 Theology constraint: ONLY from lesson-source.json | Yes | Task 6 content-core prompt; Task 7 schema |
| `craft.md` text-only, never a slide | Yes | Task 6 agent note; Task 7 schema comment |
| Schema contracts (exact field names) | Yes | Tasks 2, 3, 4 implement them exactly |
| RUN_DIR resume detection (mirrors ppt.md) | Yes | Task 7 Phase 1, Step 4 |
| Testable Node units with `node:test` | Yes | Tasks 1–4 (skill folder) |
| Unit tests: valid passes, each field missing fails | Yes | Tasks 2, 3 — 14 + 18 tests |
| Unit tests: wrong types fail | Yes | Tasks 2, 3 — type checks for string/boolean/array/number |
| Unit tests: scenes array empty fails | Yes | Task 3 — `validateLessonOutline` test |
| Unit tests: craft rendering includes materials + steps + memory_verse | Yes | Task 4 — 12 tests |
| `git commit` with exact branch name | Yes | All tasks use `feature/bible-class-intake-outline` |
| `Co-Authored-By` in every commit | Yes | All 8 commits |

### Placeholder Scan

Every code block in every task contains complete, runnable JavaScript or complete markdown prose. No `// TODO`, `...`, `INSERT_HERE`, or `TBD` markers appear in implementation or test code.

### Type-Name Consistency (shared contracts)

| Name | Used consistently across tasks |
|---|---|
| `lesson-source.json` | Tasks 2, 6, 7 |
| `lesson-outline.json` | Tasks 3, 6, 7 |
| `lesson-outline.md` | Tasks 6, 7 |
| `craft.md` | Tasks 4, 6, 7 |
| `validateLessonSource` | Tasks 2, 7 |
| `validateLessonOutline` | Tasks 3, 6 |
| `renderCraftMarkdown` | Tasks 4, 5, 6 |
| `mode=lesson_outline` | Tasks 6, 7 |
| `mode=lesson_revise` | Tasks 6, 7 |
| `lesson_outline_ready` (SendMessage signal) | Task 6 |
| `approved` field (boolean gate) | Tasks 3, 6, 7 (mirrors ppt `outline.json`) |
| `source_kind` enum `"image" \| "text"` | Tasks 2, 7 |
| `image_brief` field name | Tasks 3, 6 |
| `memory_verse.text` + `memory_verse.ref` | Tasks 3, 4 |

All names match the shared data contracts defined at the top of this document and will be consumed without modification by Plans 3 and 4.
