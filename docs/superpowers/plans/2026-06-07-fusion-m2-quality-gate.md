# Fusion M2 — 质量门控 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **执行原则(spec §0)**:全貌用活的路线图(`docs/superpowers/FUSION_ROADMAP.md`),落地用本份即时计划。完成后回更新路线图。

**Goal:** 在 Phase 4(大纲)后加一个确定性质量门控:Node `planning_validator` 校验 `outline.json`(硬错误阻塞、软警告提示),并把按页型密度目标抽成共享单一来源;同时给 per-slide Gemini 审查补传页型上下文、把方法论嵌入大纲生成、对齐过时的 schema 文档。

**Architecture:** 纯逻辑 Node 模块(`skills/_shared/`,`node:test`)做确定性校验;散文接线进 `commands/ppt.md` Phase 4(无 Node 优雅跳过);Gemini 语义审查仍由既有 review-core 承担,只补页型。密度目标 = 机器可读 `density-targets.json`(planning_validator import)+ reviewer.md 表(Gemini 读),一致性由测试守护。

**Tech Stack:** Node 22(CommonJS,`node:test`);Markdown prose + 嵌入 bash 编排;grep 结构测试守护散文。

---

## 背景(动手前必读)

- 设计依据:`docs/superpowers/specs/2026-06-07-fusion-m2-quality-gate-design.md`。**先读它**。
- `/ppt` 是 `commands/ppt.md` 的散文编排,宿主解释执行。7 阶段;Phase 4 = content-core `mode=outline` 产出 `outline.json` + `outline-preview.md`,随后 AskUserQuestion Hard Stop 让用户审批(审批后置 `approved:true`)。
- **真实 outline schema(事实权威 = `agents/content-core.md`)**:`parts[].pages[]` 每页 `{ index, title, type(6选), key_points[], layout_type(10选 snake_case), visual_weight(low|medium|high), data_elements(typed 数组), notes }`;`key_message` 在 part 级;`cover={title,subtitle,author,date}`(无 type/key_points);`end_page={type(4选),title,content}`。
- `data_elements` typed 形态(content-core.md:47):`[{type:"metric",...},{type:"chart",chart_type,...},{type:"table",...},{type:"comparison_bar",...}]`。
- 约定镜像 `skills/image-gen`:skill 目录有 `package.json`(`"type":"commonjs"`,`"scripts":{"test":"node --test"}`),纯逻辑在 `scripts/lib/*.js`(`'use strict'`+`module.exports`),测试 `test/*.test.js`(`require('node:test')`),`node --test` 从 skill 目录跑。`skills/_shared/` 已有 `package.json`+`scripts/lib/`+`test/`(M1 建的)。
- 直提 main,不开分支。每个 commit 末尾加:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

### 枚举(校验用,逐字)
- `PAGE_TYPES = ['content','data','comparison','process','quote','image']`
- `VISUAL_WEIGHTS = ['low','medium','high']`
- `END_PAGE_TYPES = ['thank_you','call_to_action','contact','q_and_a']`
- `LAYOUT_TYPES = ['single_focus','two_column_symmetric','two_column_asymmetric','three_column','hero_grid','mixed_grid','timeline','dashboard','horizontal_split','full_bleed']`

---

## File Structure
- Create `skills/_shared/references/density-targets.json` — 6 页型密度预算(机器可读单一来源)。
- Create `skills/_shared/scripts/lib/planning-validator.js` — 纯校验逻辑(无 I/O)。
- Create `skills/_shared/scripts/planning-validator-cli.js` — 薄 CLI。
- Create `skills/_shared/test/planning-validator.test.js` — 单测。
- Create `skills/_shared/test/fixtures/outline-valid.json` — 干净大纲 fixture。
- Create `skills/_shared/test/density-targets.test.js` — density-targets 与 reviewer.md 一致性。
- Create `skills/_shared/test/ppt-m2-prose.test.js` — 散文结构测试(Phase 4 接线、review-core 传 type、outline-architect 方法论+schema)。
- Modify `commands/ppt.md` — Phase 4 接线 + Phase 6 review 传 type。
- Modify `agents/review-core.md` — mode=review 传 `type`/`visual_weight`。
- Modify `skills/_shared/references/prompts/outline-architect.md` — schema 示例对齐 + 方法论嵌入。
- Modify `skills/gemini-cli/references/roles/reviewer.md` — 密度表加"与 density-targets.json 同步"指针。

---

## Task 0(用户执行,不阻塞 Task 1-5):带埋点基线生成

**这一步由用户在加载了 ppt-agent 插件的 Claude Code 会话里跑**(本仓库会话的通用 agent + 无交互 Hard Stop,跑不了真实 `/ppt`)。它补的是生成期真值,**不阻塞** Task 1-5 的代码开发——可并行,目标值在数据到位后填入基线文档。

- [ ] **Step 1: 用户在插件会话执行**（建议跳交付省时,顺带 dogfood M1 的 `--stop-at`）:
  ```
  /ppt-agent:ppt --pages=12 --stop-at=design 帮我做一套新一代小米SU7发布会的PPT
  ```
- [ ] **Step 2: 跑完保留** `${RUN_DIR}/review-manifest.json`（含每页 `final_score`/`fix_rounds`/`status`）。`review-manifest.json` 在 Phase 6 末写盘,在 stop 触发之前,故基线产物安全。
- [ ] **Step 3: 把 review-manifest.json 回贴**,据此算并写回 `docs/superpowers/plans/2026-06-07-fusion-m2-baseline-results.md`:
  - 首轮通过率 = `fix_rounds==0 的页 / 总页`;平均修复轮次 = Σ`fix_rounds`/总页;忠实 Gemini 均分。
  - 把 M2 提升目标改为"相对实测基线"。
- [ ] **Step 4: Commit** 基线文档更新。

---

## Task 1: density-targets.json + reviewer.md 指针 + 一致性测试

**Files:**
- Create: `skills/_shared/references/density-targets.json`
- Create: `skills/_shared/test/density-targets.test.js`
- Modify: `skills/gemini-cli/references/roles/reviewer.md`

- [ ] **Step 1: 写 density-targets.json**

```json
{
  "_note": "Single machine-readable source for per-page-type density budgets. Values are verbatim from gemini-cli/references/roles/reviewer.md 'Content Density Targets by Page Type'. comparison/process max_key_points take the integer upper bound of the prose range (comparison 2-3 -> 3, process 3-5 steps -> 5). cover/timeline rows from reviewer.md are NOT here: cover is a structural object (no key_points), timeline is a layout not a page type.",
  "quote": { "target_info_units": [1, 2], "max_key_points": 0 },
  "image": { "target_info_units": [1, 2], "max_key_points": 0 },
  "content": { "target_info_units": [3, 5], "max_key_points": 3 },
  "data": { "target_info_units": [4, 7], "max_key_points": 2 },
  "comparison": { "target_info_units": [4, 6], "max_key_points": 3 },
  "process": { "target_info_units": [3, 5], "max_key_points": 5 }
}
```

- [ ] **Step 2: 写失败测试** `skills/_shared/test/density-targets.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const targets = require('../references/density-targets.json');
const REVIEWER = fs.readFileSync(
  path.join(__dirname, '../../gemini-cli/references/roles/reviewer.md'), 'utf8');

test('density-targets has the 6 page-type keys', () => {
  for (const t of ['quote', 'image', 'content', 'data', 'comparison', 'process']) {
    assert.ok(targets[t], `missing target for ${t}`);
    assert.ok(Array.isArray(targets[t].target_info_units) && targets[t].target_info_units.length === 2);
    assert.strictEqual(typeof targets[t].max_key_points, 'number');
  }
});

test('reviewer.md still documents Content Density Targets and points to the JSON', () => {
  assert.match(REVIEWER, /Content Density Targets/);
  assert.match(REVIEWER, /density-targets\.json/);
});

test('reviewer.md per-type rows match density-targets.json values', () => {
  // reviewer.md table rows look like: | content | 3-5 | 3 | ...
  for (const t of ['quote', 'image', 'content', 'data', 'comparison', 'process']) {
    const [min, max] = targets[t].target_info_units;
    const row = new RegExp(`\\|\\s*${t}\\s*\\|\\s*${min}-${max}\\b`);
    assert.match(REVIEWER, row, `reviewer.md row for ${t} should show ${min}-${max} matching the JSON`);
  }
});
```

- [ ] **Step 3: 跑测试看失败** — `cd skills/_shared && node --test test/density-targets.test.js`
  Expected: FAIL（reviewer.md 还没有 `density-targets.json` 指针）。

- [ ] **Step 4: 在 reviewer.md 密度表下加指针**

在 `skills/gemini-cli/references/roles/reviewer.md` 的 "## Content Density Targets by Page Type" 表格后、`A slide exceeding...` 那行之前,插入一行:
```
> 数值与 `skills/_shared/references/density-targets.json` 同步(planning_validator 的机器可读单一来源)。改这里的数值时必须同步改该 JSON;一致性由 `_shared/test/density-targets.test.js` 守护。
```

- [ ] **Step 5: 跑测试看通过** — `cd skills/_shared && node --test test/density-targets.test.js` → PASS（3 测试）。

- [ ] **Step 6: Commit**
```bash
git add skills/_shared/references/density-targets.json skills/_shared/test/density-targets.test.js skills/gemini-cli/references/roles/reviewer.md
git commit -m "feat(ppt): add density-targets.json single source + reviewer.md pointer (Fusion M2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: planning-validator.js(完整:硬错误 + 软警告)+ 单测

**Files:**
- Create: `skills/_shared/scripts/lib/planning-validator.js`
- Create: `skills/_shared/test/fixtures/outline-valid.json`
- Create: `skills/_shared/test/planning-validator.test.js`

- [ ] **Step 1: 写干净 fixture** `skills/_shared/test/fixtures/outline-valid.json`

```json
{
  "title": "Test Deck",
  "total_pages": 3,
  "approved": false,
  "cover": { "title": "Cover", "subtitle": "sub" },
  "table_of_contents": { "sections": ["Part 1"] },
  "parts": [
    {
      "title": "Part 1",
      "key_message": "the one takeaway",
      "pages": [
        { "index": 1, "title": "P1", "type": "content", "key_points": ["a", "b"], "layout_type": "two_column_symmetric", "visual_weight": "medium" },
        { "index": 2, "title": "P2", "type": "data", "key_points": ["x"], "layout_type": "dashboard", "visual_weight": "high", "data_elements": [{ "type": "metric", "label": "Rev", "value": "$1B" }] },
        { "index": 3, "title": "P3", "type": "quote", "key_points": [], "layout_type": "single_focus", "visual_weight": "low" }
      ]
    }
  ],
  "end_page": { "type": "thank_you", "title": "Thanks", "content": "bye" }
}
```

- [ ] **Step 2: 写失败测试** `skills/_shared/test/planning-validator.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { validateOutline } = require('../scripts/lib/planning-validator');
const targets = require('../references/density-targets.json');

const VALID = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/outline-valid.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const run = (o, opts) => validateOutline(o, Object.assign({ densityTargets: targets, pagesRange: { min: 1, max: 15 } }, opts));

test('clean outline -> ok, no hard errors, no warnings', () => {
  const r = run(VALID);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.hard_errors.length, 0);
  assert.strictEqual(r.warnings.length, 0);
  assert.strictEqual(r.summary.pages, 3);
});

test('hard: missing top-level field', () => {
  const o = clone(VALID); delete o.end_page;
  const r = run(o);
  assert.strictEqual(r.ok, false);
  assert.ok(r.hard_errors.some((e) => e.field === 'end_page'));
});

test('hard: invalid page type enum', () => {
  const o = clone(VALID); o.parts[0].pages[0].type = 'slide';
  const r = run(o);
  assert.ok(r.hard_errors.some((e) => e.field === 'type' && /slide/.test(e.msg)));
});

test('hard: invalid end_page.type', () => {
  const o = clone(VALID); o.end_page.type = 'goodbye';
  assert.ok(run(o).hard_errors.some((e) => e.field === 'end_page.type'));
});

test('hard: key_points not an array', () => {
  const o = clone(VALID); o.parts[0].pages[0].key_points = 'a, b';
  assert.ok(run(o).hard_errors.some((e) => e.field === 'key_points'));
});

test('hard: missing required page field (title)', () => {
  const o = clone(VALID); delete o.parts[0].pages[1].title;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'title'));
});

test('hard: index not contiguous', () => {
  const o = clone(VALID); o.parts[0].pages[2].index = 5;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'index'));
});

test('hard: total_pages mismatch', () => {
  const o = clone(VALID); o.total_pages = 9;
  assert.ok(run(o).hard_errors.some((e) => e.field === 'total_pages'));
});

test('hard: total_pages outside requested range', () => {
  const o = clone(VALID);
  const r = run(o, { pagesRange: { min: 10, max: 15 } }); // actual 3 pages, total_pages 3 -> below range
  assert.ok(r.hard_errors.some((e) => e.field === 'total_pages' && /range/.test(e.msg)));
});

test('soft: invalid JSON value for visual_weight is hard, missing is soft', () => {
  const bad = clone(VALID); bad.parts[0].pages[0].visual_weight = 'huge';
  assert.ok(run(bad).hard_errors.some((e) => e.field === 'visual_weight'));
  const miss = clone(VALID); delete miss.parts[0].pages[0].visual_weight;
  const r = run(miss);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'visual_weight'));
});

test('soft: layout missing or unknown -> warn, not block; accepts layout_hint', () => {
  const miss = clone(VALID); delete miss.parts[0].pages[0].layout_type;
  let r = run(miss);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'layout'));
  const unknown = clone(VALID); unknown.parts[0].pages[0].layout_type = 'weird_grid';
  assert.ok(run(unknown).warnings.some((w) => w.kind === 'layout'));
  const hint = clone(VALID); delete hint.parts[0].pages[0].layout_type; hint.parts[0].pages[0].layout_hint = 'two_column_symmetric';
  assert.ok(!run(hint).warnings.some((w) => w.kind === 'layout'), 'layout_hint with valid value should not warn');
});

test('soft density: key_points exceeds max_key_points -> warn', () => {
  const o = clone(VALID); o.parts[0].pages[1].key_points = ['a', 'b', 'c', 'd']; // data max_key_points=2
  const r = run(o);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'density' && /max_key_points/.test(w.msg)));
});

test('soft density: data_elements push info_units over target max+2 -> major', () => {
  const o = clone(VALID);
  // data target max=7; make info_units = 1 key_point + 9 data_elements = 10 > 9
  o.parts[0].pages[1].data_elements = Array.from({ length: 9 }, (_, i) => ({ type: 'metric', label: 'm' + i }));
  const r = run(o);
  assert.ok(r.warnings.some((w) => w.kind === 'density' && w.severity === 'major'));
});

test('soft density: quote page with key_points -> critical', () => {
  const o = clone(VALID); o.parts[0].pages[2].key_points = ['should be empty'];
  const r = run(o);
  assert.ok(r.warnings.some((w) => w.kind === 'density' && w.severity === 'critical'));
});

test('soft: >3 consecutive same layout -> diversity warn', () => {
  const o = clone(VALID);
  const p = o.parts[0].pages;
  o.total_pages = 4;
  p.push({ index: 4, title: 'P4', type: 'content', key_points: ['a'], layout_type: 'two_column_symmetric', visual_weight: 'low' });
  // set pages 1-4 all two_column_symmetric
  p.forEach((pg) => { pg.layout_type = 'two_column_symmetric'; });
  p[2].type = 'content'; p[2].key_points = ['a']; // page 3 was quote; make content so it's not critical
  const r = run(o);
  assert.ok(r.warnings.some((w) => w.kind === 'layout_diversity'));
});

test('soft: >3 consecutive high visual_weight -> rhythm warn', () => {
  const o = clone(VALID);
  const p = o.parts[0].pages;
  o.total_pages = 4;
  p.push({ index: 4, title: 'P4', type: 'content', key_points: ['a'], layout_type: 'hero_grid', visual_weight: 'high' });
  p.forEach((pg) => { pg.visual_weight = 'high'; });
  assert.ok(run(o).warnings.some((w) => w.kind === 'visual_weight_rhythm'));
});

test('soft: part missing key_message -> warn', () => {
  const o = clone(VALID); delete o.parts[0].key_message;
  const r = run(o);
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.kind === 'key_message'));
});
```

- [ ] **Step 3: 跑测试看失败** — `cd skills/_shared && node --test test/planning-validator.test.js`
  Expected: FAIL（`Cannot find module '../scripts/lib/planning-validator'`）。

- [ ] **Step 4: 写实现** `skills/_shared/scripts/lib/planning-validator.js`

```js
'use strict';

// Pure validation of outline.json for the /ppt Phase 4 quality gate. No I/O.
// Hard errors block the workflow; soft warnings are surfaced at the Hard Stop.

const PAGE_TYPES = ['content', 'data', 'comparison', 'process', 'quote', 'image'];
const VISUAL_WEIGHTS = ['low', 'medium', 'high'];
const END_PAGE_TYPES = ['thank_you', 'call_to_action', 'contact', 'q_and_a'];
const LAYOUT_TYPES = [
  'single_focus', 'two_column_symmetric', 'two_column_asymmetric', 'three_column',
  'hero_grid', 'mixed_grid', 'timeline', 'dashboard', 'horizontal_split', 'full_bleed',
];

function countDataElements(de) {
  if (Array.isArray(de)) return de.length;
  if (typeof de === 'number') return de;
  if (de && typeof de === 'object') return Object.keys(de).length;
  return 0;
}

function collectPages(outline) {
  const pages = [];
  for (const part of (outline.parts || [])) {
    for (const pg of (part.pages || [])) pages.push(pg);
  }
  return pages;
}

// Run-length scan: call cb(value, "a-b") for each maximal run of length > maxRun
// where the key is non-null and equal. index labels use page.index when present.
function consecutiveRuns(pages, keyFn, maxRun, cb) {
  let i = 0;
  while (i < pages.length) {
    const val = keyFn(pages[i]);
    let j = i;
    while (j + 1 < pages.length && val != null && keyFn(pages[j + 1]) === val) j++;
    const runLen = j - i + 1;
    if (val != null && runLen > maxRun) {
      const a = pages[i].index != null ? pages[i].index : i + 1;
      const b = pages[j].index != null ? pages[j].index : j + 1;
      cb(val, `${a}-${b}`);
    }
    i = j + 1;
  }
}

/**
 * @param {object} outline parsed outline.json
 * @param {{densityTargets?:object, pagesRange?:{min:number,max:number}}} opts
 * @returns {{ok:boolean, hard_errors:Array, warnings:Array, summary:object}}
 */
function validateOutline(outline, opts = {}) {
  const targets = opts.densityTargets || {};
  const pagesRange = opts.pagesRange || null;
  const hard = [];
  const warn = [];
  const E = (page, field, msg) => hard.push({ page: page == null ? null : page, field, msg });
  const W = (page, kind, severity, msg) => warn.push({ page: page == null ? null : page, kind, severity, msg });
  const o = outline || {};

  for (const f of ['title', 'total_pages', 'approved', 'cover', 'parts', 'end_page']) {
    if (!(f in o)) E(null, f, `missing required top-level field "${f}"`);
  }

  if (!Array.isArray(o.parts)) {
    E(null, 'parts', 'parts must be an array');
    return finalize();
  }

  if (o.end_page && !END_PAGE_TYPES.includes(o.end_page.type)) {
    E(null, 'end_page.type', `invalid end_page.type "${o.end_page.type}" (allowed: ${END_PAGE_TYPES.join(', ')})`);
  }

  const pages = collectPages(o);

  pages.forEach((pg, i) => {
    const id = pg.index != null ? pg.index : `#${i + 1}`;
    for (const f of ['index', 'title', 'type', 'key_points']) {
      if (!(f in pg)) E(id, f, `page missing required field "${f}"`);
    }
    if ('key_points' in pg && !Array.isArray(pg.key_points)) E(id, 'key_points', 'key_points must be an array');
    if ('type' in pg && !PAGE_TYPES.includes(pg.type)) {
      E(id, 'type', `invalid type "${pg.type}" (allowed: ${PAGE_TYPES.join(', ')})`);
    }
    if ('visual_weight' in pg) {
      if (!VISUAL_WEIGHTS.includes(pg.visual_weight)) E(id, 'visual_weight', `invalid visual_weight "${pg.visual_weight}"`);
    } else {
      W(id, 'visual_weight', 'warn', 'missing visual_weight (downstream defaults to medium)');
    }

    const layout = pg.layout_type != null ? pg.layout_type : pg.layout_hint;
    if (layout == null) W(id, 'layout', 'warn', 'missing layout_type');
    else if (!LAYOUT_TYPES.includes(layout)) W(id, 'layout', 'warn', `layout "${layout}" not in the 10 canonical layout_type values`);

    if (PAGE_TYPES.includes(pg.type) && Array.isArray(pg.key_points) && targets[pg.type]) {
      const t = targets[pg.type];
      const kp = pg.key_points.length;
      const units = kp + countDataElements(pg.data_elements);
      if (kp > t.max_key_points) {
        W(id, 'density', 'warn', `${kp} key_points exceeds ${pg.type} max_key_points ${t.max_key_points}`);
      }
      const maxUnits = t.target_info_units[1];
      if ((pg.type === 'quote' || pg.type === 'image') && (kp > 0 || units > 3)) {
        W(id, 'density', 'critical', `${pg.type} page should be near-empty (info_units=${units}, key_points=${kp})`);
      } else if (units > maxUnits + 2) {
        W(id, 'density', 'major', `info_units ${units} exceeds ${pg.type} target max ${maxUnits} by >2`);
      }
    }
  });

  // index contiguity 1..N
  const indices = pages.map((p) => p.index);
  const numeric = indices.filter((x) => typeof x === 'number');
  let contiguityOk = numeric.length === pages.length;
  const sorted = [...numeric].sort((a, b) => a - b);
  const seen = new Set();
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k] !== k + 1 || seen.has(sorted[k])) contiguityOk = false;
    seen.add(sorted[k]);
  }
  if (!contiguityOk) E(null, 'index', `page index must be contiguous 1..${pages.length} with no gaps/duplicates (got [${indices.join(', ')}])`);

  if (typeof o.total_pages === 'number' && o.total_pages !== pages.length) {
    E(null, 'total_pages', `total_pages ${o.total_pages} != actual page count ${pages.length}`);
  }
  if (pagesRange && typeof o.total_pages === 'number' && (o.total_pages < pagesRange.min || o.total_pages > pagesRange.max)) {
    E(null, 'total_pages', `total_pages ${o.total_pages} outside requested range ${pagesRange.min}-${pagesRange.max}`);
  }

  consecutiveRuns(pages, (p) => (p.layout_type != null ? p.layout_type : p.layout_hint), 3,
    (val, span) => W(null, 'layout_diversity', 'warn', `pages ${span} all use layout "${val}" (>3 consecutive — monotonous)`));
  consecutiveRuns(pages, (p) => p.visual_weight, 3,
    (val, span) => { if (val === 'high') W(null, 'visual_weight_rhythm', 'warn', `pages ${span} all visual_weight high (>3 consecutive)`); });

  (o.parts || []).forEach((part, i) => {
    if (!part.key_message || !String(part.key_message).trim()) {
      W(null, 'key_message', 'warn', `part ${i + 1} ("${part.title || ''}") has no key_message`);
    }
  });

  return finalize();

  function finalize() {
    const pageCount = (o.parts || []).reduce((n, p) => n + ((p.pages || []).length), 0);
    return {
      ok: hard.length === 0,
      hard_errors: hard,
      warnings: warn,
      summary: { pages: pageCount, hard_errors: hard.length, warnings: warn.length },
    };
  }
}

module.exports = { validateOutline, countDataElements, PAGE_TYPES, VISUAL_WEIGHTS, END_PAGE_TYPES, LAYOUT_TYPES };
```

- [ ] **Step 5: 跑测试看通过** — `cd skills/_shared && node --test test/planning-validator.test.js` → 全 PASS。
  若某断言因 fixture 细节不符,**只调 fixture/测试以匹配 spec 行为**,不弱化校验逻辑。

- [ ] **Step 6: 全套回归** — `cd skills/_shared && node --test`（M1 的 28 + M2 的 density + validator,0 fail）。

- [ ] **Step 7: Commit**
```bash
git add skills/_shared/scripts/lib/planning-validator.js skills/_shared/test/planning-validator.test.js skills/_shared/test/fixtures/outline-valid.json
git commit -m "feat(ppt): add planning_validator (hard+soft outline.json checks) (Fusion M2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: CLI + 接线 ppt.md Phase 4

**Files:**
- Create: `skills/_shared/scripts/planning-validator-cli.js`
- Modify: `commands/ppt.md`（Phase 4）
- Create: `skills/_shared/test/ppt-m2-prose.test.js`

- [ ] **Step 1: 写 CLI** `skills/_shared/scripts/planning-validator-cli.js`

```js
#!/usr/bin/env node
'use strict';

// Thin CLI over scripts/lib/planning-validator.js.
// Usage: node planning-validator-cli.js --outline <path> [--targets <path>] [--pages <min-max>]
// Prints the JSON report to stdout. Exit 0 if no hard errors, exit 1 if hard errors (or bad input).

const fs = require('fs');
const { validateOutline } = require('./lib/planning-validator');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function parsePages(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const n = Number(s);
  return Number.isFinite(n) ? { min: n, max: n } : null;
}

try {
  const outlinePath = arg('--outline');
  if (!outlinePath) throw new Error('--outline <path> is required');
  const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
  const targetsPath = arg('--targets');
  const densityTargets = targetsPath ? JSON.parse(fs.readFileSync(targetsPath, 'utf8')) : {};
  const report = validateOutline(outline, { densityTargets, pagesRange: parsePages(arg('--pages')) });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
  process.exit(1);
}
```

- [ ] **Step 2: 手动验证 CLI**

```bash
node skills/_shared/scripts/planning-validator-cli.js \
  --outline skills/_shared/test/fixtures/outline-valid.json \
  --targets skills/_shared/references/density-targets.json --pages 1-15; echo "exit=$?"
```
Expected: 打印 `"ok": true` 的报告,`exit=0`。
```bash
node skills/_shared/scripts/planning-validator-cli.js --outline /nonexistent.json; echo "exit=$?"
```
Expected: `{"ok":false,"error":...}`,`exit=1`。

- [ ] **Step 3: 写失败结构测试** `skills/_shared/test/ppt-m2-prose.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const PPT = read('../../../commands/ppt.md');

test('Phase 4 invokes planning-validator-cli before the outline Hard Stop', () => {
  assert.match(PPT, /planning-validator-cli\.js/);
  // appears within Phase 4 (before Phase 5 heading)
  const phase4 = PPT.match(/## Phase 4:[\s\S]*?(?=\n## Phase 5:)/);
  assert.ok(phase4, 'Phase 4 section should exist');
  assert.match(phase4[0], /planning-validator-cli\.js/, 'validator must be wired inside Phase 4');
});

test('Phase 4 routes hard errors to content-core revise and surfaces warnings at the Hard Stop', () => {
  const phase4 = PPT.match(/## Phase 4:[\s\S]*?(?=\n## Phase 5:)/)[0];
  assert.match(phase4, /mode=revise|revise/);
  assert.match(phase4, /warning|警告/i);
});
```

- [ ] **Step 4: 跑测试看失败** — `cd skills/_shared && node --test test/ppt-m2-prose.test.js` → FAIL。

- [ ] **Step 5: 接线 ppt.md Phase 4**

在 `commands/ppt.md` "## Phase 4: Outline Planning (Hard Stop)" 中,**在 item 1(content-core mode=outline 产出 outline.json)之后、item 2(MANDATORY AskUserQuestion)之前**,插入新 item:

    2. **策划质量门控(planning_validator)**:大纲产出后,审批前,先确定性校验 `outline.json`:
       ```bash
       node skills/_shared/scripts/planning-validator-cli.js \
         --outline "${RUN_DIR}/outline.json" \
         --targets skills/_shared/references/density-targets.json \
         --pages "${PAGES}" > "${RUN_DIR}/planning-validation.json"
       ```
       读 `${RUN_DIR}/planning-validation.json` 的 `{ ok, hard_errors, warnings }`:
       - **有 `hard_errors`(exit 1)**:不要把大纲交给用户。用 `Task(content-core, mode=revise, feedback=<hard_errors 摘要>)` 让其修复,再重跑本校验,直到 `ok:true`。
       - **`ok:true` 且有 `warnings`**:继续到审批 Hard Stop,但**把 warnings 摘要并入下一步 AskUserQuestion 的说明**(密度超标/布局单调/visual_weight 节奏/缺 key_message 等),让用户知情决定是否让 content-core revise。
       - **无 Node 可用**:跳过本校验(优雅降级),在产物里注明"未做结构校验"。

    (随后原有的 AskUserQuestion 审批步骤顺延为 item 3,content-core revise 循环为 item 4 等——只在编号上顺延,不改其内容。)

  注意:把原 Phase 4 的 item 2/3/4 的编号顺延为 3/4/5(文字不变),保持列表连贯。

- [ ] **Step 6: 跑结构测试看通过** — `cd skills/_shared && node --test test/ppt-m2-prose.test.js` → PASS。

- [ ] **Step 7: Commit**
```bash
git add skills/_shared/scripts/planning-validator-cli.js skills/_shared/test/ppt-m2-prose.test.js commands/ppt.md
git commit -m "feat(ppt): wire planning_validator into Phase 4 gate (Fusion M2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: E — reviewer 页型上下文

**Files:**
- Modify: `agents/review-core.md`（mode=review）
- Modify: `commands/ppt.md`（Phase 6 review 派发说明)
- Modify: `skills/_shared/test/ppt-m2-prose.test.js`（加断言）

- [ ] **Step 1: 加失败断言** — APPEND 到 `skills/_shared/test/ppt-m2-prose.test.js`:

```js
const REVIEW_CORE = read('../../agents/review-core.md');

test('review-core mode=review passes the slide type into the Gemini prompt', () => {
  // mode=review section should read outline.json and include the page's `type` (+ visual_weight) in slide context
  assert.match(REVIEW_CORE, /type/);
  assert.match(REVIEW_CORE, /visual_weight/);
  // the per-slide review context must mention passing type (not only holistic)
  assert.match(REVIEW_CORE, /Slide Context[\s\S]*type|type[\s\S]*Slide Context/i);
});
```

- [ ] **Step 2: 跑看失败** — `cd skills/_shared && node --test test/ppt-m2-prose.test.js` → 新断言 FAIL（mode=review 当前不传 type）。

- [ ] **Step 3: 改 review-core.md mode=review**

在 `agents/review-core.md` 的 `mode=review` 流程里,读 `outline.json` 那一步(当前取 title/context),**额外取该页的 `type` 与 `visual_weight`**;并在构造 gemini-cli prompt 的 "Slide Context" 处,把它们写进去。把现有 "slide context (index, title, presentation style name)" 改为 "slide context (index, title, **page type, visual_weight**, presentation style name)"。具体:
- 在 "Read `${run_dir}/outline.json` to get the slide's title and context" 之后补:"并取该页的 `type`(content/data/quote/...) 与 `visual_weight`,用于让 reviewer 按页型密度目标判定(封面/quote/image 等低密页不被当普通内容页扣分)。"
- 在传给 gemini-cli 的 prompt 的 `## Slide Context` 段加入 `Page type: ${PAGE_TYPE}` 和 `Visual weight: ${VISUAL_WEIGHT}`。

- [ ] **Step 4: 同步 ppt.md Phase 6 派发说明**

在 `commands/ppt.md` Phase 6 派发 review-core 处(`mode=review slide_index=${N}`),补一句说明:"review-core 会从 outline.json 读该页 `type`/`visual_weight` 并传给 reviewer,使按页型密度判定生效。"

- [ ] **Step 5: 跑看通过** — `cd skills/_shared && node --test test/ppt-m2-prose.test.js` → PASS。

- [ ] **Step 6: Commit**
```bash
git add agents/review-core.md commands/ppt.md skills/_shared/test/ppt-m2-prose.test.js
git commit -m "feat(ppt): pass page type/visual_weight into per-slide Gemini review (Fusion M2 E)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: D — outline-architect schema 对齐 + 方法论嵌入

**Files:**
- Modify: `skills/_shared/references/prompts/outline-architect.md`
- Modify: `skills/_shared/test/ppt-m2-prose.test.js`（加断言）

- [ ] **Step 1: 加失败断言** — APPEND 到 `skills/_shared/test/ppt-m2-prose.test.js`:

```js
const OUTLINE_ARCH = read('../references/prompts/outline-architect.md');

test('outline-architect JSON example uses layout_type (10-set) and data_elements', () => {
  assert.match(OUTLINE_ARCH, /"layout_type"/);
  assert.match(OUTLINE_ARCH, /"data_elements"/);
  assert.doesNotMatch(OUTLINE_ARCH, /"layout_hint"/);
});

test('outline-architect embeds the three methodology principles', () => {
  // question-first, content-first, every-section-has-a-point
  assert.match(OUTLINE_ARCH, /从问题开始|问题出发/);
  assert.match(OUTLINE_ARCH, /内容先行/);
  assert.match(OUTLINE_ARCH, /每.*(节|part).*(论点|说明什么|takeaway|key_message)/);
});
```

- [ ] **Step 2: 跑看失败** — FAIL。

- [ ] **Step 3: 对齐 schema 示例** — 在 `outline-architect.md` 的 `[PPT_OUTLINE]` JSON 示例里,把页对象的:
  - `"layout_hint": "single_focus|two_column|three_column|hero_grid|mixed_grid"` 改为 `"layout_type": "single_focus|two_column_symmetric|two_column_asymmetric|three_column|hero_grid|mixed_grid|timeline|dashboard|horizontal_split|full_bleed"`。
  - 在 `key_points` 后补 `data_elements` 示例条目(引用 content-core 的 typed 形态):
    ```
    "data_elements": [
      { "type": "metric", "label": "Revenue", "value": "$2.4B", "delta": "+18%" },
      { "type": "chart", "chart_type": "bar", "data_points": [] }
    ],
    ```
  - 其余字段(type/visual_weight/transition_cue/notes)不动。

- [ ] **Step 4: 嵌入方法论** — 在 `outline-architect.md` 指导部分(生成原则处)加一节:

```
## 方法论(内容先行)

生成大纲前与生成中,遵循三条:
1. **从问题开始,不从模板开始** —— 先明确"这套 PPT 要回答的核心问题是什么",据此排页,而非套固定结构。
2. **内容先行,设计后行** —— 大纲只确定内容与论点,不预设视觉效果(配色/动效留到设计阶段)。
3. **每节有明确论点** —— 每个 part 必须有非空 `key_message`(这一节的"一句话要点");每页要能回答"这一页想说明什么"。
```

- [ ] **Step 5: 跑看通过** — `cd skills/_shared && node --test test/ppt-m2-prose.test.js` → PASS。

- [ ] **Step 6: 全套回归** — `cd skills/_shared && node --test` → 全绿。

- [ ] **Step 7: Commit**
```bash
git add skills/_shared/references/prompts/outline-architect.md skills/_shared/test/ppt-m2-prose.test.js
git commit -m "feat(ppt): align outline schema example + embed content-first methodology (Fusion M2 D)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review（authoring 时完成）
- **Spec 覆盖**:C planning_validator(Task 2 硬+软,Task 3 接线)· density-targets DRY(Task 1)· E 页型上下文(Task 4)· D schema 对齐+方法论(Task 5)· Task 0 基线(用户)。全部 spec §3-6 有对应任务。
- **占位符**:无;每步含完整代码/确切编辑/确切命令与期望。
- **类型一致**:`validateOutline` 返回 `{ok,hard_errors,warnings,summary}` 在 lib/CLI/测试/ppt.md 四处一致;枚举常量在 lib 与背景节一致;density-targets 6 键在 JSON/测试/lib 取用一致。
- **不误判**:layout 软校验(不硬拒)、cover 无 type(不硬校验)、visual_weight 缺失=软——均按修正后的真实 schema。
- **划出范围**:B/F、布局枚举大清理、P3 不在本计划(见 roadmap)。

## Execution Handoff
计划完成。两种执行方式:
1. **Subagent-Driven(推荐)** —— 每任务派全新子代理,任务间 spec+质量两段审查(像 M1)。
2. **Inline Execution** —— 本会话内按 checkpoint 批量执行。
Task 0 由用户在插件会话执行,与 Task 1-5 并行,不阻塞。
