# Bible-Class PPTX Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `/bible-class` Phases 5–6 — assemble a storybook-layout HTML slide set, convert it to an editable PPTX via a new `storybook` preset in the `html-slide-to-pptx` converter, generate an HTML preview and `speaker-notes.md`, and bundle the full output directory for delivery.

**This is Plan 4 of 4.** It depends on:
- Plan 2: `<RD>/lesson-outline.json` (scenes array with `title`, `narration`, `interaction`, `image_brief`; memory verse; lesson title).
- Plan 3: `<RD>/images/scene-{NN}.png` (zero-padded 2 digits, e.g. `scene-01.png`), `<RD>/master/master-reference.png`, `<RD>/craft.md`.

**Two-repo architecture.** This plan spans two repositories:

| Repo | Path | Branch |
|---|---|---|
| ppt-agent | `/Users/kevinchen/PPT_Agent/ppt-agent` | `feature/bible-class-pptx-delivery` |
| ppt-agent-workflow-san | `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san` | `feature/bible-class-pptx-delivery` |

The converter (`html-slide-to-pptx`) lives **exclusively in the workflow-san repo**. All new `storybook_preset.js`, `layout_storybook.js`, and changes to `preflight_qa.js` / `html_to_pptx.js` go there. The HTML composer (`skills/bible-class/lib/html_compose.js`) and the command file (`commands/bible-class.md` Phase 5–6 sections) live in ppt-agent.

**Recommendation: extend the converter in-place** (workflow-san). Do NOT vendor a copy into ppt-agent — the converter already has two presets registered in `html_to_pptx.js`; adding a third follows its established pattern. The composer in ppt-agent then shell-invokes the converter with an absolute path, just as any external tool call.

**Converter invocation model.** The existing `html_to_pptx.js` accepts `<input.html> <output.pptx> [--preset=...]` for **one HTML file → one PPTX file**. Because a lesson has multiple slides (cover + N scenes + optional memory verse), the composer writes one HTML file per slide and the Phase 5–6 delivery step loops over the HTML files, producing per-slide PPTX objects, then merges them. Alternatively — and this is the chosen approach — the composer writes a single **combined** HTML file that wraps all slide `<section>` elements and the converter is extended to iterate sections. However, reviewing the actual `html_to_pptx.js` code reveals it processes exactly one HTML file and passes it directly to a preset extractor; adding multi-section support would require invasive changes. **Design decision forced by the converter's structure: one HTML file per slide, loop in the delivery command, PptxGenJS `pptx` object shared across slides before `writeFile`.** The delivery step creates a single PptxGenJS instance, calls `pptx.addSlide()` once per HTML via the storybook renderer, then writes one PPTX file. This is implemented in a new thin orchestrator `scripts/compose_pptx.js` inside the converter (not a change to `html_to_pptx.js` itself).

**Tech Stack:** Node.js ≥18 (CommonJS), `cheerio` + `pptxgenjs` (already in workflow-san's `package.json`), built-in `node:test` + `node:assert`. Mirrors all converter conventions: `normalizeText`, `ensureDir`, `fitFontSize`, `assessBlock`.

**Plan-wide conventions:**
- All paths are absolute in code; relative in this document only when scoped to a known base.
- Run converter tests from: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test`.
- Run composer tests from: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/bible-class/test/`.
- Commit after every task. Append `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` to every commit body.

---

## Shared Contracts (from Plans 2–3)

```
lesson-outline.json schema:
{
  "title": "string",
  "scripture_ref": "string",
  "teaching": {
    "scenes": [
      {
        "index": 1,
        "title": "string",
        "key_message": "string",
        "narration": "string",
        "interaction": "string",
        "image_brief": "string"
      }
    ]
  },
  "craft": { ... },
  "memory_verse": { "text": "string", "ref": "string" }
}

File layout:
<RD>/lesson-outline.json
<RD>/images/scene-01.png  … scene-NN.png
<RD>/master/master-reference.png
<RD>/craft.md
<RD>/slides/slide-01.html … slide-NN.html   (written by html_compose.js)
<RD>/output/presentation.pptx
<RD>/output/index.html
<RD>/output/speaker-notes.md
<RD>/output/craft.md
<RD>/output/images/scene-01.png … scene-NN.png
```

---

## File Structure

```
ppt-agent/
└── skills/
    └── bible-class/
        ├── lib/
        │   └── html_compose.js          # NEW — storybook HTML composer
        └── test/
            └── html_compose.test.js     # NEW

ppt-agent-workflow-san/html-slide-to-pptx/
└── scripts/
    ├── storybook_preset.js              # NEW — DOM extractor
    ├── layout_storybook.js              # NEW — coordinate + font-fit
    ├── compose_pptx.js                  # NEW — multi-slide orchestrator
    ├── html_to_pptx.js                  # MODIFY — register storybook preset
    └── preflight_qa.js                  # MODIFY — storybook caption checks
    └── test/
        ├── storybook_preset.test.js     # NEW
        ├── layout_storybook.test.js     # NEW
        └── compose_pptx.test.js         # NEW

ppt-agent/
└── commands/
    └── bible-class.md                   # MODIFY — add Phase 5–6 sections
```

---

## Task 1: HTML Composer (`skills/bible-class/lib/html_compose.js`)

**Repo:** ppt-agent  
**Files:**
- Create: `skills/bible-class/lib/html_compose.js`
- Create: `skills/bible-class/test/html_compose.test.js`

The composer generates one self-contained HTML file per slide (cover + scenes + optional memory-verse slide) and writes them to `<RD>/slides/`. Each file has `<body data-preset="storybook">` so the converter auto-detects the preset. The image `src` attribute uses a relative path from `<RD>/slides/` to `<RD>/images/`, i.e. `../images/scene-01.png`.

### Slide HTML structure

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body data-preset="storybook" data-slide-type="scene|cover|memory-verse">
  <div class="storybook-image">
    <img src="../images/scene-01.png" alt="Scene 1">
  </div>
  <div class="storybook-caption">
    <h2 class="caption-title">洗门徒的脚</h2>
    <p class="caption-body">耶稣弯下腰……</p>
  </div>
</body></html>
```

### `- [ ]` Step 1: Write the failing test

Create `skills/bible-class/test/html_compose.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composeStorybookHtml } = require('../lib/html_compose');

function tmpRun() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-compose-'));
  fs.mkdirSync(path.join(dir, 'images'));
  // write a dummy image so path refs are checkable
  fs.writeFileSync(path.join(dir, 'images', 'scene-01.png'), 'PNG');
  fs.writeFileSync(path.join(dir, 'images', 'scene-02.png'), 'PNG');
  return dir;
}

const minimalOutline = {
  title: '主日学：耶稣洗门徒的脚',
  scripture_ref: '约翰福音 13:1-17',
  teaching: {
    scenes: [
      { index: 1, title: '晚餐前', key_message: '耶稣谦卑服事', narration: '门徒们坐下来吃晚饭。', interaction: '你会为朋友做什么？', image_brief: 'Last supper table' },
      { index: 2, title: '洗脚', key_message: '谦卑的榜样', narration: '耶稣弯腰洗门徒的脚。', interaction: '这让你感到惊讶吗？', image_brief: 'Jesus washing feet' },
    ],
  },
  memory_verse: { text: '你们也当彼此洗脚。', ref: '约翰福音 13:14' },
};

test('writes cover slide as slide-00.html with data-preset=storybook', () => {
  const dir = tmpRun();
  const files = composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const coverPath = path.join(dir, 'slides', 'slide-00.html');
  assert.ok(fs.existsSync(coverPath), 'slide-00.html must exist');
  const html = fs.readFileSync(coverPath, 'utf8');
  assert.match(html, /data-preset="storybook"/);
  assert.match(html, /data-slide-type="cover"/);
  assert.match(html, /主日学：耶稣洗门徒的脚/);
  assert.match(html, /约翰福音 13:1-17/);
  assert.ok(files.includes(coverPath));
});

test('writes one scene slide per scene, numbered 01..NN', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const s1 = fs.readFileSync(path.join(dir, 'slides', 'slide-01.html'), 'utf8');
  const s2 = fs.readFileSync(path.join(dir, 'slides', 'slide-02.html'), 'utf8');
  assert.match(s1, /data-slide-type="scene"/);
  assert.match(s1, /晚餐前/);
  assert.match(s1, /门徒们坐下来吃晚饭/);
  assert.match(s1, /storybook-image/);
  assert.match(s1, /\.\.\/images\/scene-01\.png/);
  assert.match(s2, /洗脚/);
  assert.match(s2, /\.\.\/images\/scene-02\.png/);
});

test('includes interaction text in caption-body', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const html = fs.readFileSync(path.join(dir, 'slides', 'slide-01.html'), 'utf8');
  assert.match(html, /你会为朋友做什么？/);
});

test('writes memory-verse slide when memory_verse present', () => {
  const dir = tmpRun();
  composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  const mv = fs.readFileSync(path.join(dir, 'slides', 'slide-03.html'), 'utf8');
  assert.match(mv, /data-slide-type="memory-verse"/);
  assert.match(mv, /你们也当彼此洗脚/);
  assert.match(mv, /约翰福音 13:14/);
});

test('skips memory-verse slide when memory_verse absent', () => {
  const dir = tmpRun();
  const outline2 = { ...minimalOutline, memory_verse: null };
  const files = composeStorybookHtml({ outline: outline2, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  // only cover + 2 scenes = 3 files
  assert.strictEqual(files.length, 3);
});

test('returns sorted absolute paths of all written slides', () => {
  const dir = tmpRun();
  const files = composeStorybookHtml({ outline: minimalOutline, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') });
  // cover + 2 scenes + memory verse = 4
  assert.strictEqual(files.length, 4);
  assert.ok(files[0].endsWith('slide-00.html'));
  assert.ok(files[files.length - 1].endsWith('slide-03.html'));
});

test('throws when outline.teaching.scenes is empty or missing', () => {
  const dir = tmpRun();
  assert.throws(
    () => composeStorybookHtml({ outline: { title: 'x', teaching: { scenes: [] } }, imagesDir: path.join(dir, 'images'), slidesDir: path.join(dir, 'slides') }),
    /scenes/
  );
});
```

### `- [ ]` Step 2: Run test to verify it fails

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
node --test skills/bible-class/test/html_compose.test.js
```
Expected: FAIL — "Cannot find module '../lib/html_compose'".

### `- [ ]` Step 3: Write minimal implementation

Create `skills/bible-class/lib/html_compose.js`:

```js
'use strict';
const fs = require('node:fs');
const path = require('node:path');

/**
 * Zero-pad n to 2 digits.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Escape text for safe insertion into HTML attribute values and content.
 * Covers the five XML/HTML characters that must be escaped.
 * @param {string} text
 * @returns {string}
 */
function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a complete storybook slide HTML string.
 * @param {{type:string, title:string, body:string, imageSrc?:string, subtext?:string}} opts
 * @returns {string}
 */
function renderSlideHtml({ type, title, body, imageSrc, subtext }) {
  const imgBlock = imageSrc
    ? `  <div class="storybook-image">\n    <img src="${esc(imageSrc)}" alt="${esc(title)}">\n  </div>\n`
    : '';
  const subtextBlock = subtext
    ? `    <p class="caption-subtext">${esc(subtext)}</p>\n`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${esc(title)}</title></head>
<body data-preset="storybook" data-slide-type="${esc(type)}">
${imgBlock}  <div class="storybook-caption">
    <h2 class="caption-title">${esc(title)}</h2>
    <p class="caption-body">${esc(body)}</p>
${subtextBlock}  </div>
</body>
</html>`;
}

/**
 * Compose storybook HTML slides from a lesson outline.
 *
 * Writes:
 *   <slidesDir>/slide-00.html  — cover
 *   <slidesDir>/slide-01.html  — scene 1
 *   …
 *   <slidesDir>/slide-NN.html  — scene N
 *   <slidesDir>/slide-{NN+1}.html — memory verse (if present)
 *
 * Image src uses a relative path from slidesDir: "../images/scene-{NN}.png"
 * (assumes slidesDir is one level below imagesDir's parent, i.e. both are
 * direct children of RUN_DIR).
 *
 * @param {{
 *   outline: object,
 *   imagesDir: string,
 *   slidesDir: string
 * }} opts
 * @returns {string[]} Sorted absolute paths of all written HTML files.
 */
function composeStorybookHtml({ outline, imagesDir, slidesDir }) {
  if (!outline || !outline.teaching || !Array.isArray(outline.teaching.scenes) || outline.teaching.scenes.length === 0) {
    throw new Error('composeStorybookHtml: outline.teaching.scenes must be a non-empty array');
  }
  fs.mkdirSync(slidesDir, { recursive: true });

  const written = [];

  // 0. Cover slide (no image — use master reference if present, else text-only)
  const masterSrc = path.join(imagesDir, '..', 'master', 'master-reference.png');
  const coverImgSrc = fs.existsSync(masterSrc) ? '../master/master-reference.png' : null;
  const coverPath = path.join(slidesDir, 'slide-00.html');
  fs.writeFileSync(coverPath, renderSlideHtml({
    type: 'cover',
    title: outline.title || '主日学课程',
    body: outline.scripture_ref || '',
    imageSrc: coverImgSrc,
  }), 'utf8');
  written.push(coverPath);

  // 1. Scene slides
  for (const scene of outline.teaching.scenes) {
    const nn = pad2(scene.index);
    const imgSrc = `../images/scene-${nn}.png`;
    const slidePath = path.join(slidesDir, `slide-${nn}.html`);
    fs.writeFileSync(slidePath, renderSlideHtml({
      type: 'scene',
      title: scene.title || '',
      body: scene.narration || '',
      imageSrc: imgSrc,
      subtext: scene.interaction || '',
    }), 'utf8');
    written.push(slidePath);
  }

  // 2. Memory-verse slide (optional)
  if (outline.memory_verse && outline.memory_verse.text) {
    const mvIndex = outline.teaching.scenes.length + 1;
    const mvPath = path.join(slidesDir, `slide-${pad2(mvIndex)}.html`);
    fs.writeFileSync(mvPath, renderSlideHtml({
      type: 'memory-verse',
      title: outline.memory_verse.text,
      body: outline.memory_verse.ref || '',
    }), 'utf8');
    written.push(mvPath);
  }

  written.sort();
  return written;
}

module.exports = { composeStorybookHtml, renderSlideHtml, pad2, esc };
```

### `- [ ]` Step 4: Run test to verify it passes

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
node --test skills/bible-class/test/html_compose.test.js
```
Expected: PASS (7 tests).

### `- [ ]` Step 5: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/html_compose.js skills/bible-class/test/html_compose.test.js
git commit -m "$(cat <<'EOF'
feat(bible-class): storybook HTML composer

Writes cover + scene + memory-verse slides as data-preset="storybook"
HTML files for downstream html-slide-to-pptx conversion.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Storybook Preset — DOM Extractor (`storybook_preset.js`)

**Repo:** ppt-agent-workflow-san  
**Files:**
- Create: `scripts/storybook_preset.js`
- Create: `test/storybook_preset.test.js` (new `test/` directory in converter)

Mirrors `ai_runtime_preset.js` conventions: `normalizeText`, `cheerio.load`, named `PRESET` constant, `extract…` + `render…` exported pair.

### `- [ ]` Step 1: Write the failing test

Create `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/storybook_preset.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PRESET, extractStorybook } = require('../scripts/storybook_preset');

function writeHtml(html) {
  const f = path.join(os.tmpdir(), `sb-test-${Date.now()}.html`);
  fs.writeFileSync(f, html, 'utf8');
  return f;
}

const SCENE_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body data-preset="storybook" data-slide-type="scene">
  <div class="storybook-image">
    <img src="../images/scene-02.png" alt="Washing feet">
  </div>
  <div class="storybook-caption">
    <h2 class="caption-title">洗脚</h2>
    <p class="caption-body">耶稣弯腰洗门徒的脚。</p>
    <p class="caption-subtext">这让你感到惊讶吗？</p>
  </div>
</body></html>`;

const COVER_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body data-preset="storybook" data-slide-type="cover">
  <div class="storybook-caption">
    <h2 class="caption-title">主日学：耶稣洗门徒的脚</h2>
    <p class="caption-body">约翰福音 13:1-17</p>
  </div>
</body></html>`;

const MV_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body data-preset="storybook" data-slide-type="memory-verse">
  <div class="storybook-caption">
    <h2 class="caption-title">你们也当彼此洗脚。</h2>
    <p class="caption-body">约翰福音 13:14</p>
  </div>
</body></html>`;

test('PRESET constant equals storybook', () => {
  assert.strictEqual(PRESET, 'storybook');
});

test('extractStorybook: scene slide returns imageSrc, title, body, subtext, slideType', () => {
  const f = writeHtml(SCENE_HTML);
  const m = extractStorybook(f);
  assert.strictEqual(m.preset, 'storybook');
  assert.strictEqual(m.slideType, 'scene');
  assert.strictEqual(m.imageSrc, '../images/scene-02.png');
  assert.strictEqual(m.title, '洗脚');
  assert.strictEqual(m.body, '耶稣弯腰洗门徒的脚。');
  assert.strictEqual(m.subtext, '这让你感到惊讶吗？');
});

test('extractStorybook: cover slide has null imageSrc when no img tag', () => {
  const f = writeHtml(COVER_HTML);
  const m = extractStorybook(f);
  assert.strictEqual(m.slideType, 'cover');
  assert.strictEqual(m.imageSrc, null);
  assert.strictEqual(m.title, '主日学：耶稣洗门徒的脚');
  assert.strictEqual(m.body, '约翰福音 13:1-17');
  assert.strictEqual(m.subtext, '');
});

test('extractStorybook: memory-verse slide extracts verse text as title', () => {
  const f = writeHtml(MV_HTML);
  const m = extractStorybook(f);
  assert.strictEqual(m.slideType, 'memory-verse');
  assert.strictEqual(m.title, '你们也当彼此洗脚。');
  assert.strictEqual(m.body, '约翰福音 13:14');
});

test('extractStorybook: normalizes whitespace and non-breaking spaces', () => {
  const html = `<body data-preset="storybook" data-slide-type="scene">
    <div class="storybook-caption">
      <h2 class="caption-title">  洗 脚  </h2>
      <p class="caption-body">正文</p>
    </div></body>`;
  const f = writeHtml(`<!DOCTYPE html><html><head></head>${html}</html>`);
  const m = extractStorybook(f);
  assert.strictEqual(m.title, '洗 脚');
});
```

### `- [ ]` Step 2: Run test to verify it fails

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/storybook_preset.test.js
```
Expected: FAIL — "Cannot find module '../scripts/storybook_preset'".

### `- [ ]` Step 3: Write minimal implementation

Create `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/storybook_preset.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { computeStorybookLayout } = require('./layout_storybook');

const COLORS = {
  overlayDark: '000000',
  overlayMid:  '1A1A2E',
  captionBg:   'FFFFFFCC',  // used as fill with transparency hint for docs; PPTX uses separate alpha
  titleText:   'FFFFFF',
  bodyText:    'F0F0F0',
  subtextText: 'CCCCCC',
  accentYellow:'FFD166',
  coverBg:     '163A5F',
};

const FONT_CN = 'PingFang SC';
const FONT_EN = 'Arial';

/** @type {string} */
const PRESET = 'storybook';

function normalizeText(text) {
  return String(text || '')
    .replace(/ /g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Extract a semantic model from a storybook HTML slide file.
 * @param {string} htmlPath
 * @returns {{
 *   preset: string,
 *   slideType: string,
 *   imageSrc: string|null,
 *   title: string,
 *   body: string,
 *   subtext: string
 * }}
 */
function extractStorybook(htmlPath) {
  const $ = cheerio.load(fs.readFileSync(htmlPath, 'utf8'));
  const body = $('body');
  const slideType = normalizeText(body.attr('data-slide-type')) || 'scene';

  // Image: first <img> inside .storybook-image
  const imgEl = $('.storybook-image img').first();
  const imageSrc = imgEl.length ? (imgEl.attr('src') || null) : null;

  const title   = normalizeText($('.caption-title').first().text());
  const body_   = normalizeText($('.caption-body').first().text());
  const subtext = normalizeText($('.caption-subtext').first().text());

  return { preset: PRESET, slideType, imageSrc, title, body: body_, subtext };
}

/**
 * Add a storybook slide to an existing PptxGenJS instance.
 * Returns { model, layout } for inspection / testing.
 *
 * @param {object} model   Result of extractStorybook()
 * @param {string} htmlDir Absolute directory of the source HTML (for resolving relative image paths)
 * @param {object} pptx    PptxGenJS instance (has pptx.addSlide())
 * @returns {{ model: object, layout: object, slide: object }}
 */
function addStorybookSlide(model, htmlDir, pptx) {
  const layout = computeStorybookLayout(model);
  const slide = pptx.addSlide();

  if (model.slideType === 'cover') {
    // Cover: solid deep-blue background, large centred title, subtitle below
    slide.background = { color: COLORS.coverBg };

    // Resolve master image if imageSrc present
    if (model.imageSrc) {
      const absImg = path.resolve(htmlDir, model.imageSrc);
      if (fs.existsSync(absImg)) {
        slide.addImage({ path: absImg, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: 'cover', w: 13.33, h: 7.5 } });
        // Dark overlay rectangle for readability
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: COLORS.overlayDark, transparency: 45 }, line: { type: 'none' } });
      }
    }

    slide.addText(model.title, {
      x: 1.0, y: layout.cover.titleY, w: 11.33, h: layout.cover.titleH,
      fontFace: FONT_CN, fontSize: layout.cover.titleFont,
      bold: true, color: COLORS.titleText,
      align: 'center', valign: 'middle',
      fit: 'none', margin: 0,
    });

    if (model.body) {
      slide.addText(model.body, {
        x: 1.0, y: layout.cover.bodyY, w: 11.33, h: 0.40,
        fontFace: FONT_CN, fontSize: layout.cover.bodyFont,
        color: COLORS.subtextText, align: 'center',
        fit: 'none', margin: 0,
      });
    }

  } else if (model.slideType === 'memory-verse') {
    // Memory verse: accent background, large centred verse text, reference below
    slide.background = { color: COLORS.overlayMid };

    slide.addText(model.title, {
      x: 0.72, y: layout.verse.titleY, w: 11.89, h: layout.verse.titleH,
      fontFace: FONT_CN, fontSize: layout.verse.titleFont,
      bold: true, color: COLORS.accentYellow,
      align: 'center', valign: 'middle',
      fit: 'none', margin: 0,
    });

    if (model.body) {
      slide.addText(model.body, {
        x: 0.72, y: layout.verse.refY, w: 11.89, h: 0.32,
        fontFace: FONT_CN, fontSize: layout.verse.refFont,
        color: COLORS.subtextText, align: 'center',
        fit: 'none', margin: 0,
      });
    }

  } else {
    // Scene slide: full-bleed image + semi-transparent caption band at bottom
    if (model.imageSrc) {
      const absImg = path.resolve(htmlDir, model.imageSrc);
      if (fs.existsSync(absImg)) {
        slide.addImage({ path: absImg, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: 'cover', w: 13.33, h: 7.5 } });
      }
    }

    // Caption band: dark semi-transparent rectangle
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: layout.scene.captionY, w: 13.33, h: layout.scene.captionH,
      fill: { color: COLORS.overlayDark, transparency: 20 },
      line: { type: 'none' },
    });

    slide.addText(model.title, {
      x: 0.5, y: layout.scene.titleY, w: 12.33, h: layout.scene.titleH,
      fontFace: FONT_CN, fontSize: layout.scene.titleFont,
      bold: true, color: COLORS.titleText,
      fit: 'none', margin: 0, valign: 'top',
    });

    if (model.body) {
      slide.addText(model.body, {
        x: 0.5, y: layout.scene.bodyY, w: 12.33, h: layout.scene.bodyH,
        fontFace: FONT_CN, fontSize: layout.scene.bodyFont,
        color: COLORS.bodyText,
        lineSpacingMultiple: 1.08,
        fit: 'none', margin: 0, valign: 'top',
      });
    }

    if (model.subtext) {
      slide.addText(`💬 ${model.subtext}`, {
        x: 0.5, y: layout.scene.subtextY, w: 12.33, h: layout.scene.subtextH,
        fontFace: FONT_CN, fontSize: layout.scene.subtextFont,
        color: COLORS.accentYellow, italic: true,
        fit: 'none', margin: 0, valign: 'top',
      });
    }
  }

  return { model, layout, slide };
}

module.exports = { PRESET, extractStorybook, addStorybookSlide, COLORS, FONT_CN, FONT_EN };
```

### `- [ ]` Step 4: Run test to verify it passes

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/storybook_preset.test.js
```
Expected: PASS (5 tests). Note: `storybook_preset.js` requires `layout_storybook.js` which does not exist yet — create a stub first if the require fails at load time:

```js
// scripts/layout_storybook.js STUB (replace fully in Task 3)
'use strict';
function computeStorybookLayout(model) { return {}; }
module.exports = { computeStorybookLayout };
```

Run again after stub creation — all 5 tests should pass (they only test extraction, not layout).

### `- [ ]` Step 5: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san
git add html-slide-to-pptx/scripts/storybook_preset.js html-slide-to-pptx/test/storybook_preset.test.js
git commit -m "$(cat <<'EOF'
feat(html-slide-to-pptx): storybook preset DOM extractor

Extracts imageSrc, title, body, subtext, slideType from
data-preset="storybook" HTML slides for PPTX rendering.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Storybook Layout (`layout_storybook.js`)

**Repo:** ppt-agent-workflow-san  
**Files:**
- Create (replace stub): `scripts/layout_storybook.js`
- Create: `test/layout_storybook.test.js`

Uses `fitFontSize` from `layout_utils.js` (the exported name is `fitFontSize`; also available: `estimateLines`, `requiredTextHeightIn`, `weightedLen`, `clamp`, `bulletBlock`). Slide dimensions: LAYOUT_WIDE = 13.33 × 7.5 inches.

### Layout coordinate system

```
SCENE slide (full-bleed image + caption band):
  Caption band starts at captionY = 4.90, height captionH = 2.60
    Title:   titleY  = captionY + 0.16 = 5.06, titleH  = 0.44
    Body:    bodyY   = titleY + titleH + 0.08, bodyH = 1.40
    Subtext: subtextY = bodyY + bodyH + 0.08, subtextH = 0.32

COVER slide:
  titleY  = 2.60,  titleH = 1.20
  bodyY   = titleY + titleH + 0.24 = 4.04, (uses fixed bodyFont)

MEMORY-VERSE slide:
  titleY  = 1.80,  titleH = 2.80
  refY    = titleY + titleH + 0.28 = 4.88
```

### `- [ ]` Step 1: Write the failing test

Create `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/layout_storybook.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeStorybookLayout, MAIN } = require('../scripts/layout_storybook');

const SCENE_MODEL = {
  preset: 'storybook',
  slideType: 'scene',
  imageSrc: '../images/scene-01.png',
  title: '洗脚',
  body: '耶稣弯腰为门徒洗脚，显示了真正的谦卑和爱。',
  subtext: '这让你感到惊讶吗？',
};

const LONG_BODY_MODEL = {
  preset: 'storybook',
  slideType: 'scene',
  imageSrc: '../images/scene-01.png',
  title: '非常非常长的标题文字：远超过正常长度的标题'.repeat(2),
  body: '超长正文超长正文超长正文超长正文超长正文超长正文超长正文超长正文超长正文超长正文'.repeat(3),
  subtext: '互动提问内容',
};

const COVER_MODEL = {
  preset: 'storybook', slideType: 'cover', imageSrc: null,
  title: '主日学：耶稣洗门徒的脚', body: '约翰福音 13:1-17', subtext: '',
};

const VERSE_MODEL = {
  preset: 'storybook', slideType: 'memory-verse', imageSrc: null,
  title: '你们也当彼此洗脚。', body: '约翰福音 13:14', subtext: '',
};

test('MAIN exports scene caption position constants', () => {
  assert.ok(typeof MAIN.captionY === 'number' && MAIN.captionY > 0);
  assert.ok(typeof MAIN.captionH === 'number' && MAIN.captionH > 0);
  assert.ok(MAIN.captionY + MAIN.captionH <= 7.5, 'caption must fit inside 7.5in slide');
});

test('scene layout: titleY >= captionY, bodyY > titleY + titleH, subtextY > bodyY + bodyH', () => {
  const layout = computeStorybookLayout(SCENE_MODEL);
  const s = layout.scene;
  assert.ok(s.titleY >= MAIN.captionY, 'title must be inside caption band');
  assert.ok(s.bodyY >= s.titleY + s.titleH - 0.001, 'body starts at or after title bottom');
  assert.ok(s.subtextY >= s.bodyY + s.bodyH - 0.001, 'subtext starts at or after body bottom');
  assert.ok(s.subtextY + s.subtextH <= 7.5 + 0.02, 'subtext fits within slide height (with 0.02in tolerance)');
});

test('scene layout: titleFont is a positive number, min 14pt', () => {
  const layout = computeStorybookLayout(SCENE_MODEL);
  assert.ok(layout.scene.titleFont >= 14);
  assert.ok(layout.scene.titleFont <= 40);
});

test('scene layout: long content still produces font >= minSizePt (10pt) without throwing', () => {
  const layout = computeStorybookLayout(LONG_BODY_MODEL);
  assert.ok(layout.scene.titleFont >= 10);
  assert.ok(layout.scene.bodyFont >= 10);
});

test('cover layout: titleY is in upper half of slide', () => {
  const layout = computeStorybookLayout(COVER_MODEL);
  assert.ok(layout.cover.titleY < 4.0, 'cover title should be in upper half');
  assert.ok(layout.cover.titleFont >= 20);
});

test('memory-verse layout: refY > titleY + titleH', () => {
  const layout = computeStorybookLayout(VERSE_MODEL);
  const v = layout.verse;
  assert.ok(v.refY >= v.titleY + v.titleH - 0.001);
  assert.ok(v.titleFont >= 16);
});

test('scene layout returns all required keys', () => {
  const layout = computeStorybookLayout(SCENE_MODEL);
  const required = ['captionY', 'captionH', 'titleY', 'titleH', 'titleFont', 'bodyY', 'bodyH', 'bodyFont', 'subtextY', 'subtextH', 'subtextFont'];
  for (const k of required) {
    assert.ok(k in layout.scene, `layout.scene.${k} must exist`);
  }
});
```

### `- [ ]` Step 2: Run test to verify it fails

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/layout_storybook.test.js
```
Expected: FAIL (stub returns `{}`, assertions on `layout.scene` fail).

### `- [ ]` Step 3: Write minimal implementation

Replace the stub at `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/layout_storybook.js`:

```js
'use strict';
const { fitFontSize } = require('./layout_utils');

// All coordinates in inches. Slide is LAYOUT_WIDE: 13.33 × 7.5 in.
const MAIN = {
  // Scene: full-bleed image behind; caption band at bottom.
  captionY:  4.90,
  captionH:  2.60,
  titlePad:  0.16,  // gap from top of caption band to title baseline
  titleH:    0.44,
  titleBodyGap: 0.08,
  bodyH:     1.40,
  bodySubtextGap: 0.08,
  subtextH:  0.32,
  captionXPad: 0.5,   // left padding for text boxes inside caption
  captionW:  12.33,   // usable text width (13.33 - 2×0.5)

  // Cover
  coverTitleY: 2.60,
  coverTitleH: 1.20,
  coverBodyGap: 0.24,

  // Memory verse
  verseTitleY: 1.80,
  verseTitleH: 2.80,
  verseRefGap: 0.28,
};

/**
 * Compute storybook layout for a single slide model.
 * @param {{ slideType: string, title: string, body: string, subtext: string }} model
 * @returns {{ scene?: object, cover?: object, verse?: object }}
 */
function computeStorybookLayout(model) {
  if (model.slideType === 'cover') {
    const titleFont = fitFontSize({
      text: model.title,
      widthIn: 11.33,
      heightIn: MAIN.coverTitleH,
      startSizePt: 36,
      minSizePt: 20,
      lineSpacing: 1.08,
      charFactor: 0.96,
    });
    const bodyFont = fitFontSize({
      text: model.body,
      widthIn: 11.33,
      heightIn: 0.40,
      startSizePt: 18,
      minSizePt: 12,
      lineSpacing: 1.0,
      charFactor: 0.96,
    });
    return {
      cover: {
        titleY: MAIN.coverTitleY,
        titleH: MAIN.coverTitleH,
        titleFont,
        bodyY: MAIN.coverTitleY + MAIN.coverTitleH + MAIN.coverBodyGap,
        bodyFont,
      },
    };
  }

  if (model.slideType === 'memory-verse') {
    const titleFont = fitFontSize({
      text: model.title,
      widthIn: 11.89,
      heightIn: MAIN.verseTitleH,
      startSizePt: 36,
      minSizePt: 16,
      lineSpacing: 1.12,
      charFactor: 0.96,
    });
    const refFont = fitFontSize({
      text: model.body,
      widthIn: 11.89,
      heightIn: 0.32,
      startSizePt: 16,
      minSizePt: 12,
      lineSpacing: 1.0,
      charFactor: 0.96,
    });
    return {
      verse: {
        titleY: MAIN.verseTitleY,
        titleH: MAIN.verseTitleH,
        titleFont,
        refY: MAIN.verseTitleY + MAIN.verseTitleH + MAIN.verseRefGap,
        refFont,
      },
    };
  }

  // Default: scene
  const titleY = MAIN.captionY + MAIN.titlePad;
  const titleFont = fitFontSize({
    text: model.title,
    widthIn: MAIN.captionW,
    heightIn: MAIN.titleH,
    startSizePt: 28,
    minSizePt: 14,
    lineSpacing: 1.0,
    charFactor: 0.97,
  });

  const bodyY = titleY + MAIN.titleH + MAIN.titleBodyGap;
  const bodyFont = fitFontSize({
    text: model.body,
    widthIn: MAIN.captionW,
    heightIn: MAIN.bodyH,
    startSizePt: 18,
    minSizePt: 10,
    lineSpacing: 1.08,
    charFactor: 0.96,
  });

  const subtextY = bodyY + MAIN.bodyH + MAIN.bodySubtextGap;
  const subtextFont = fitFontSize({
    text: model.subtext,
    widthIn: MAIN.captionW,
    heightIn: MAIN.subtextH,
    startSizePt: 14,
    minSizePt: 10,
    lineSpacing: 1.0,
    charFactor: 0.96,
  });

  return {
    scene: {
      captionY: MAIN.captionY,
      captionH: MAIN.captionH,
      titleY,
      titleH: MAIN.titleH,
      titleFont,
      bodyY,
      bodyH: MAIN.bodyH,
      bodyFont,
      subtextY,
      subtextH: MAIN.subtextH,
      subtextFont,
    },
  };
}

module.exports = { computeStorybookLayout, MAIN };
```

### `- [ ]` Step 4: Run test to verify it passes

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/layout_storybook.test.js
```
Expected: PASS (7 tests).

### `- [ ]` Step 5: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san
git add html-slide-to-pptx/scripts/layout_storybook.js html-slide-to-pptx/test/layout_storybook.test.js
git commit -m "$(cat <<'EOF'
feat(html-slide-to-pptx): storybook layout with CJK font fitting

Full-bleed scene caption band, cover, memory-verse coordinate maps;
uses fitFontSize() from layout_utils.js for CJK-aware text sizing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Multi-Slide PPTX Orchestrator (`compose_pptx.js`) + Preflight QA

**Repo:** ppt-agent-workflow-san  
**Files:**
- Create: `scripts/compose_pptx.js`
- Modify: `scripts/preflight_qa.js` — add `storybookChecks` function and `storybook` preset branch
- Create: `test/compose_pptx.test.js`

The orchestrator creates one PptxGenJS instance, iterates over a list of HTML slide paths, calls `addStorybookSlide` for each, then calls `pptx.writeFile`. It also accepts a `--dump-model` flag that writes the extracted model array as JSON (enabling the test to assert on model + layout without touching PPTX bytes).

### `- [ ]` Step 1: Write the failing test

Create `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/compose_pptx.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, buildModels } = require('../scripts/compose_pptx');

// Minimal storybook slide HTML for tests
function writeSlide(dir, name, type, title, body, subtext, imgSrc) {
  const imgBlock = imgSrc ? `  <div class="storybook-image"><img src="${imgSrc}"></div>\n` : '';
  const subBlock = subtext ? `    <p class="caption-subtext">${subtext}</p>\n` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body data-preset="storybook" data-slide-type="${type}">
${imgBlock}  <div class="storybook-caption">
    <h2 class="caption-title">${title}</h2>
    <p class="caption-body">${body}</p>
${subBlock}  </div>
</body></html>`;
  const p = path.join(dir, name);
  fs.writeFileSync(p, html, 'utf8');
  return p;
}

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'compose-pptx-')); }

test('parseArgs: extracts slides, output and optional dump-model', () => {
  const args = parseArgs(['--slides', '/a/1.html,/a/2.html', '--output', '/out/p.pptx', '--dump-model', '/out/model.json']);
  assert.deepStrictEqual(args.slides, ['/a/1.html', '/a/2.html']);
  assert.strictEqual(args.output, '/out/p.pptx');
  assert.strictEqual(args.dumpModel, '/out/model.json');
});

test('parseArgs: also accepts --slides-dir and reads *.html files sorted', () => {
  const dir = tmpDir();
  writeSlide(dir, 'slide-00.html', 'cover', 'Cover', '', '');
  writeSlide(dir, 'slide-01.html', 'scene', 'Scene', 'body', 'q');
  const args = parseArgs(['--slides-dir', dir, '--output', '/out/p.pptx']);
  assert.strictEqual(args.slides.length, 2);
  assert.ok(args.slides[0].endsWith('slide-00.html'));
  assert.ok(args.slides[1].endsWith('slide-01.html'));
});

test('buildModels: extracts models from slide HTML array', () => {
  const dir = tmpDir();
  const p0 = writeSlide(dir, 'slide-00.html', 'cover', 'Title', 'John 1:1', '');
  const p1 = writeSlide(dir, 'slide-01.html', 'scene', '洗脚', '正文', '互动');
  const models = buildModels([p0, p1]);
  assert.strictEqual(models.length, 2);
  assert.strictEqual(models[0].slideType, 'cover');
  assert.strictEqual(models[0].title, 'Title');
  assert.strictEqual(models[1].slideType, 'scene');
  assert.strictEqual(models[1].subtext, '互动');
});

test('buildModels: each model entry includes htmlPath and htmlDir', () => {
  const dir = tmpDir();
  const p = writeSlide(dir, 'slide-01.html', 'scene', 'T', 'B', 'S');
  const models = buildModels([p]);
  assert.strictEqual(models[0].htmlPath, p);
  assert.strictEqual(models[0].htmlDir, dir);
});

test('buildModels: throws when a slide file does not exist', () => {
  assert.throws(() => buildModels(['/nonexistent/slide-01.html']), /not found|ENOENT|nonexistent/i);
});

test('buildModels: cover + scene + memory-verse in order produces 3 entries', () => {
  const dir = tmpDir();
  const p0 = writeSlide(dir, 'slide-00.html', 'cover', 'Cover', '', '');
  const p1 = writeSlide(dir, 'slide-01.html', 'scene', 'Scene', 'b', 'q');
  const p2 = writeSlide(dir, 'slide-02.html', 'memory-verse', 'Verse text', 'John 1:1', '');
  const models = buildModels([p0, p1, p2]);
  assert.strictEqual(models.length, 3);
  assert.strictEqual(models[2].slideType, 'memory-verse');
});
```

### `- [ ]` Step 2: Run test to verify it fails

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/compose_pptx.test.js
```
Expected: FAIL — "Cannot find module '../scripts/compose_pptx'".

### `- [ ]` Step 3: Write minimal implementation

Create `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js`:

```js
#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const { extractStorybook, addStorybookSlide } = require('./storybook_preset');

function usage() {
  console.error(
    'Usage: node scripts/compose_pptx.js\n' +
    '  (--slides <a.html,b.html,...> | --slides-dir <dir>)\n' +
    '  --output <output.pptx>\n' +
    '  [--dump-model <model.json>]\n' +
    '  [--title "Lesson title"]'
  );
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv  e.g. process.argv.slice(2)
 * @returns {{slides:string[], output:string, dumpModel:string|null, title:string}}
 */
function parseArgs(argv) {
  const opts = { slides: [], output: null, dumpModel: null, title: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--slides':
        opts.slides = String(v).split(',').map(s => s.trim()).filter(Boolean);
        i++; break;
      case '--slides-dir': {
        const dir = v; i++;
        const entries = fs.readdirSync(dir)
          .filter(f => f.endsWith('.html'))
          .sort()
          .map(f => path.join(dir, f));
        opts.slides = entries;
        break;
      }
      case '--output': opts.output = v; i++; break;
      case '--dump-model': opts.dumpModel = v; i++; break;
      case '--title': opts.title = v; i++; break;
      default: break;
    }
  }
  return opts;
}

/**
 * Extract a model entry for each HTML slide path.
 * Each entry is the extractStorybook() result augmented with htmlPath and htmlDir.
 * @param {string[]} htmlPaths
 * @returns {object[]}
 */
function buildModels(htmlPaths) {
  return htmlPaths.map(p => {
    if (!fs.existsSync(p)) throw new Error(`compose_pptx: slide file not found: ${p}`);
    const model = extractStorybook(p);
    model.htmlPath = p;
    model.htmlDir  = path.dirname(p);
    return model;
  });
}

/**
 * Build a PPTX file from a list of storybook HTML slide paths.
 * Returns the model array (for --dump-model / tests).
 * @param {{ slides:string[], output:string, dumpModel?:string, title?:string }} opts
 * @returns {Promise<object[]>} models
 */
async function composePptx(opts) {
  if (!opts.slides || opts.slides.length === 0) throw new Error('compose_pptx: no slides provided');
  if (!opts.output) throw new Error('compose_pptx: --output is required');

  const models = buildModels(opts.slides);

  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.author  = 'PPT Agent';
  pptx.company = 'bible-class';
  pptx.subject = 'Sunday School Bible Story';
  pptx.title   = opts.title || (models[0] && models[0].title) || 'Lesson';
  pptx.theme   = { headFontFace: 'PingFang SC', bodyFontFace: 'PingFang SC' };

  for (const model of models) {
    addStorybookSlide(model, model.htmlDir, pptx);
  }

  if (opts.dumpModel) {
    fs.mkdirSync(path.dirname(opts.dumpModel), { recursive: true });
    fs.writeFileSync(opts.dumpModel, JSON.stringify(models, null, 2), 'utf8');
  }

  fs.mkdirSync(path.dirname(opts.output), { recursive: true });
  await pptx.writeFile({ fileName: opts.output });
  return models;
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.output) { usage(); process.exit(1); }
  composePptx(opts)
    .then((models) => console.log(`Wrote ${models.length} slides → ${opts.output}`))
    .catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { parseArgs, buildModels, composePptx };
```

Now add `storybookChecks` to `preflight_qa.js`. Append to the existing `preflight_qa.js`:

Open `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/preflight_qa.js` and apply these changes:

1. Add a `require` for the storybook layout near the top (after the existing layout requires):

```js
const { computeStorybookLayout, MAIN: SB_MAIN } = require('./layout_storybook');
```

2. Add a `STORYBOOK_PRESET` constant:

```js
const STORYBOOK_PRESET = 'storybook';
```

3. Add the `storybookChecks` function before `summarize`:

```js
function storybookChecks(model) {
  const layout = computeStorybookLayout(model);
  const results = [];

  if (model.slideType === 'scene') {
    const s = layout.scene;
    results.push(assessBlock({
      name: 'scene.title',
      text: model.title,
      widthIn: SB_MAIN.captionW,
      heightIn: SB_MAIN.titleH,
      fontSizePt: s.titleFont,
      lineSpacing: 1.0,
      charFactor: 0.97,
      severityIfFail: 'high',
      note: 'Scene title in caption band — overflow pushes body text off-slide.',
    }));
    results.push(assessBlock({
      name: 'scene.body',
      text: model.body,
      widthIn: SB_MAIN.captionW,
      heightIn: SB_MAIN.bodyH,
      fontSizePt: s.bodyFont,
      lineSpacing: 1.08,
      charFactor: 0.96,
      severityIfFail: 'high',
      note: 'Narration text in caption band — most common overflow site.',
    }));
    if (model.subtext) {
      results.push(assessBlock({
        name: 'scene.subtext',
        text: model.subtext,
        widthIn: SB_MAIN.captionW,
        heightIn: SB_MAIN.subtextH,
        fontSizePt: s.subtextFont,
        lineSpacing: 1.0,
        charFactor: 0.96,
        severityIfFail: 'medium',
        note: 'Interaction subtext — lowest priority but should not be cut off.',
      }));
    }
    // Spacing checks
    results.push(assessSpacing({
      name: 'scene.captionBandFit',
      availableIn: SB_MAIN.captionH,
      neededIn: SB_MAIN.titleH + SB_MAIN.titleBodyGap + SB_MAIN.bodyH + SB_MAIN.bodySubtextGap + SB_MAIN.subtextH + SB_MAIN.titlePad,
      severityIfFail: 'high',
      note: 'Total stacked caption content vs available caption band height.',
    }));
  } else if (model.slideType === 'cover') {
    const c = layout.cover;
    results.push(assessBlock({
      name: 'cover.title',
      text: model.title,
      widthIn: 11.33,
      heightIn: SB_MAIN.coverTitleH,
      fontSizePt: c.titleFont,
      lineSpacing: 1.08,
      charFactor: 0.96,
      severityIfFail: 'high',
      note: 'Cover title — main visual hook.',
    }));
    results.push(assessBlock({
      name: 'cover.body',
      text: model.body,
      widthIn: 11.33,
      heightIn: 0.40,
      fontSizePt: c.bodyFont,
      lineSpacing: 1.0,
      charFactor: 0.96,
      severityIfFail: 'low',
      note: 'Cover scripture reference — secondary text.',
    }));
  } else if (model.slideType === 'memory-verse') {
    const v = layout.verse;
    results.push(assessBlock({
      name: 'verse.title',
      text: model.title,
      widthIn: 11.89,
      heightIn: SB_MAIN.verseTitleH,
      fontSizePt: v.titleFont,
      lineSpacing: 1.12,
      charFactor: 0.96,
      severityIfFail: 'high',
      note: 'Memory verse text — key teaching moment.',
    }));
    results.push(assessBlock({
      name: 'verse.ref',
      text: model.body,
      widthIn: 11.89,
      heightIn: 0.32,
      fontSizePt: v.refFont,
      lineSpacing: 1.0,
      charFactor: 0.96,
      severityIfFail: 'low',
      note: 'Verse reference label.',
    }));
  }

  return { results, layout };
}
```

4. In the `main()` function, add the storybook branch inside the preset dispatch:

```js
else if (preset === STORYBOOK_PRESET) payload = storybookChecks(model);
```

5. In `usage()` and `detectPreset` branches, add `STORYBOOK_PRESET`.

The full diff context makes these edits clear — see the actual file to locate exact insertion points.

### `- [ ]` Step 4: Run test to verify it passes

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/compose_pptx.test.js
```
Expected: PASS (6 tests).

### `- [ ]` Step 5: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san
git add html-slide-to-pptx/scripts/compose_pptx.js html-slide-to-pptx/scripts/preflight_qa.js html-slide-to-pptx/test/compose_pptx.test.js
git commit -m "$(cat <<'EOF'
feat(html-slide-to-pptx): storybook multi-slide PPTX orchestrator + preflight QA

compose_pptx.js builds one PptxGenJS deck from N storybook HTML files.
preflight_qa.js gains storybookChecks() for caption overflow detection.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Register `storybook` Preset in `html_to_pptx.js`

**Repo:** ppt-agent-workflow-san  
**Files:**
- Modify: `scripts/html_to_pptx.js`
- Update: `references/presets.md`

The existing `html_to_pptx.js` handles one HTML file at a time. For `storybook` we redirect to `compose_pptx.js` (which handles multi-slide). When called with a single storybook slide file and `--preset=storybook`, it is also valid — `compose_pptx.js` accepts a single path. This keeps the `html_to_pptx.js` contract intact (one input file, one output pptx) while allowing the delivery command to call `compose_pptx.js` directly for multi-slide use.

No new test file is needed for this registration task — the behavioral test is the full-run manual verification in Task 6. The registration change is small and surgical.

### `- [ ]` Step 1: Edit `html_to_pptx.js`

In `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/html_to_pptx.js`, apply the following changes:

Add the import after the existing `ai_runtime_preset` require:
```js
const STORYBOOK_PRESET = 'storybook';
```

In `detectPreset`, add before the return statement:
```js
  if (declared === STORYBOOK_PRESET) return STORYBOOK_PRESET;
```
(The existing `if (declared) return declared;` already covers this; make sure `STORYBOOK_PRESET` string matches `'storybook'`.)

Add a `runStorybook` function:
```js
async function runStorybook(opts) {
  const { composePptx } = require('./compose_pptx');
  const models = await composePptx({ slides: [opts.input], output: opts.output, dumpModel: opts.dumpModel });
  console.log(opts.output);
  return models;
}
```

In `main()`, add the dispatch branch:
```js
  if (preset === STORYBOOK_PRESET) return runStorybook(opts);
```

Update `usage()` to include `storybook` in the preset list.

### `- [ ]` Step 2: Update `references/presets.md`

Append to the file:

```markdown
## storybook

Source files: `<RD>/slides/slide-{NN}.html` (written by `skills/bible-class/lib/html_compose.js`)

Semantic regions:
1. `data-slide-type="cover"` — lesson title + scripture reference ± master reference image
2. `data-slide-type="scene"` — full-bleed scene PNG + caption band (title / narration / interaction question)
3. `data-slide-type="memory-verse"` — accent background + large verse text + reference label

Important styling choices captured in code:
- LAYOUT_WIDE (13.33 × 7.5 in) with full-bleed `addImage` + `sizing:{type:"cover"}`
- Caption band rendered as a semi-transparent `ShapeType.rect` overlay (not a rasterised screenshot)
- All text boxes are native editable PptxGenJS text; font sizes computed with `fitFontSize()` from `layout_utils.js`
- CJK default font: PingFang SC; Latin: Arial

Multi-slide usage (preferred for delivery):
```
node scripts/compose_pptx.js --slides-dir <RD>/slides --output <RD>/output/presentation.pptx --title "主日学"
```

Single-slide via legacy entry:
```
node scripts/html_to_pptx.js <RD>/slides/slide-01.html <out.pptx> --preset=storybook
```
```

### `- [ ]` Step 3: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san
git add html-slide-to-pptx/scripts/html_to_pptx.js html-slide-to-pptx/references/presets.md
git commit -m "$(cat <<'EOF'
feat(html-slide-to-pptx): register storybook preset in html_to_pptx.js

Dispatches data-preset="storybook" slides to compose_pptx.js.
Documents storybook layout in references/presets.md.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `commands/bible-class.md` — Phases 5–6 (Delivery)

**Repo:** ppt-agent  
**Files:**
- Modify: `commands/bible-class.md`

This is a Markdown command file (not unit-testable). The instructions below are the exact prose to insert into the Phase 5 and Phase 6 sections.

### `- [ ]` Step 1: Add Phase 5 section to `commands/bible-class.md`

Locate the Phase 5 heading (or insert after Phase 4) and add:

---

### Phase 5 — PPT Assembly

**Inputs consumed:**
- `<RD>/lesson-outline.json` — provides `title`, `scripture_ref`, `teaching.scenes[]`, `memory_verse`
- `<RD>/images/scene-{NN}.png` — scene illustrations from Phase 4
- `<RD>/master/master-reference.png` — character reference (used on cover if present)
- `<RD>/craft.md` — craft instructions (delivered as-is, does not go into PPTX)

**Step 5.1 — Compose HTML slides**

Run from `ppt-agent` root:

```bash
node -e "
const { composeStorybookHtml } = require('./skills/bible-class/lib/html_compose');
const outline = JSON.parse(require('fs').readFileSync('${RUN_DIR}/lesson-outline.json', 'utf8'));
const files = composeStorybookHtml({
  outline,
  imagesDir: '${RUN_DIR}/images',
  slidesDir: '${RUN_DIR}/slides',
});
console.log('Wrote', files.length, 'slide HTML files');
files.forEach(f => console.log(' ', f));
"
```

Expected output: `Wrote N slide HTML files` listing paths from `slide-00.html` (cover) through `slide-{NN}.html` (memory verse if present).

Verification: `ls ${RUN_DIR}/slides/` should show `.html` files sorted from `slide-00.html`. Open one in a browser to confirm the image path resolves correctly (the relative `../images/scene-01.png` works when served from the `slides/` directory).

**Step 5.2 — Convert to PPTX**

Run from `ppt-agent-workflow-san/html-slide-to-pptx`:

```bash
OUTLINE_TITLE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('${RUN_DIR}/lesson-outline.json','utf8')).title)")
node scripts/compose_pptx.js \
  --slides-dir "${RUN_DIR}/slides" \
  --output "${RUN_DIR}/output/presentation.pptx" \
  --dump-model "${RUN_DIR}/output/slides-model.json" \
  --title "${OUTLINE_TITLE}"
```

The converter path is: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js`

Verification: `ls -lh ${RUN_DIR}/output/presentation.pptx` — file should exist and be > 50 KB (an empty PPTX is ~25 KB; images push it significantly higher). Open `presentation.pptx` in PowerPoint/Keynote and verify: scene slides have full-bleed images, title/narration text boxes are editable, cover has the lesson title.

If `composePptx` throws `ENOENT` for an image path, it means a scene image was not generated in Phase 4. Check `${RUN_DIR}/image-manifest.json` to confirm all scenes are present. Missing images produce a blank image slot in the PPTX (the code checks `fs.existsSync` before calling `addImage`), not a crash.

**Step 5.3 — Preflight QA (optional but recommended)**

Check each slide model for caption overflow before opening:

```bash
for slide_model in $(node -e "
const models = JSON.parse(require('fs').readFileSync('${RUN_DIR}/output/slides-model.json','utf8'));
models.forEach((m,i)=>process.stdout.write(JSON.stringify({...m,_idx:i})+'\n'));
"); do
  node /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/preflight_qa.js \
    <(echo "$slide_model") --preset=storybook 2>/dev/null | \
    node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(r.summary.counts.fail>0) console.warn('FAIL:', JSON.stringify(r.summary));"
done
```

Any `fail` entries with severity `high` mean the narration text for that scene is too long; trim it in `lesson-outline.json` and re-run Steps 5.1–5.2.

---

### Phase 6 — Delivery

**Step 6.1 — Copy images to output**

```bash
mkdir -p "${RUN_DIR}/output/images"
cp "${RUN_DIR}/images/"*.png "${RUN_DIR}/output/images/"
```

**Step 6.2 — Generate HTML preview (`index.html`)**

The `preview-template.html` uses `<object data="...svg...">` to embed SVGs. For storybook slides the slide content is already rendered into the PPTX; the HTML preview uses the PNG images directly. Replace the `<object>` element usage with `<img>` tags.

Generate `${RUN_DIR}/output/index.html` by substituting the four placeholders in `preview-template.html`:

```bash
OUTLINE=$(cat "${RUN_DIR}/lesson-outline.json")
TITLE=$(echo "$OUTLINE" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).title)")
ACCENT="#4A90D9"   # calm bible-story blue; can be overridden by style.lock.json accent if present

# Build SLIDES_JSON: one entry per output image (sorted), label = scene title
SLIDES_JSON=$(node -e "
const fs = require('fs');
const outline = JSON.parse(fs.readFileSync('${RUN_DIR}/lesson-outline.json','utf8'));
const slides = [];
// Cover
slides.push({ file: 'images/master-reference.png', label: outline.title });
// Scenes
for (const s of outline.teaching.scenes) {
  const nn = String(s.index).padStart(2,'0');
  slides.push({ file: \`images/scene-\${nn}.png\`, label: s.title });
}
// Memory verse (text only, no image — use a placeholder entry)
if (outline.memory_verse && outline.memory_verse.text) {
  slides.push({ file: '', label: outline.memory_verse.text });
}
process.stdout.write(JSON.stringify(slides, null, 2));
")

TEMPLATE=$(cat /Users/kevinchen/PPT_Agent/ppt-agent/skills/_shared/assets/preview-template.html)

# Adaptation note: preview-template uses <object data="...svg+xml"> for SVGs.
# For storybook slides we use <img> tags instead. Replace the object element
# in gallery and scroll build code with img elements. The safest approach is a
# sed replacement in the generated file (no modification to the shared template).

node -e "
const fs = require('fs');
let html = fs.readFileSync('/Users/kevinchen/PPT_Agent/ppt-agent/skills/_shared/assets/preview-template.html', 'utf8');
html = html.replace('{{TITLE}}', process.env.TITLE);
html = html.replace('{{LOGO}}', '圣');
html = html.replace('{{ACCENT_COLOR}}', process.env.ACCENT);
html = html.replace('{{SLIDES_JSON}}', process.env.SLIDES_JSON);
// Swap SVG <object> for <img> in the JS build code (PNG slides, not SVGs)
html = html.replace(
  /<object data=\"\\\${s.file}\" type=\"image\/svg\+xml\"><\/object>/g,
  '<img src=\"\${s.file}\" style=\"width:100%;aspect-ratio:16/9;display:block;\" alt=\"\${s.label}\" onerror=\"this.style.background=\\\"#1a1a2e\\\"\"/>'
);
html = html.replace(
  /<object data=\"\\\${s.file}\" type=\"image\/svg\+xml\" style[^>]+><\/object>/g,
  '<img src=\"\${s.file}\" style=\"width:100%;max-height:\${maxH};display:block;\" alt=\"\${s.label}\" onerror=\"this.style.background=\\\"#1a1a2e\\\"\"/>'
);
fs.writeFileSync('${RUN_DIR}/output/index.html', html, 'utf8');
" TITLE="\$TITLE" ACCENT="\$ACCENT" SLIDES_JSON="\$SLIDES_JSON"
```

Verification: Open `${RUN_DIR}/output/index.html` in a browser. Gallery mode should show scene images in a grid; clicking a thumbnail should enter presentation mode. Slides with `file: ''` (memory verse) will show a broken image placeholder — acceptable, or add a fallback background colour via `onerror`.

**Step 6.3 — Generate `speaker-notes.md`**

```bash
node -e "
const fs = require('fs');
const outline = JSON.parse(fs.readFileSync('${RUN_DIR}/lesson-outline.json','utf8'));
const lines = [];
lines.push('# 讲稿 / Speaker Notes');
lines.push('');
lines.push(\`**课题：** \${outline.title}\`);
lines.push(\`**经文：** \${outline.scripture_ref}\`);
lines.push('');
lines.push('---');
lines.push('');
for (const s of outline.teaching.scenes) {
  const nn = String(s.index).padStart(2,'0');
  lines.push(\`## 第 \${nn} 幅：\${s.title}\`);
  lines.push('');
  lines.push(\`**旁白：** \${s.narration}\`);
  lines.push('');
  lines.push(\`**互动：** \${s.interaction}\`);
  lines.push('');
}
if (outline.memory_verse && outline.memory_verse.text) {
  lines.push('---');
  lines.push('');
  lines.push('## 金句');
  lines.push('');
  lines.push(\`> \${outline.memory_verse.text}\`);
  lines.push(\`>\`);
  lines.push(\`> ——\${outline.memory_verse.ref}\`);
  lines.push('');
}
fs.writeFileSync('${RUN_DIR}/output/speaker-notes.md', lines.join('\n'), 'utf8');
console.log('Wrote speaker-notes.md');
"
```

**Step 6.4 — Copy `craft.md` to output**

```bash
cp "${RUN_DIR}/craft.md" "${RUN_DIR}/output/craft.md"
```

**Step 6.5 — Final bundle verification (hard stop)**

Run the following checklist before marking Phase 6 complete:

```bash
echo "=== Output bundle ==="
ls -lh "${RUN_DIR}/output/"
echo ""
echo "=== File presence checks ==="
for f in presentation.pptx index.html speaker-notes.md craft.md; do
  if [ -f "${RUN_DIR}/output/$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ MISSING: $f"
  fi
done
echo ""
echo "=== Image count ==="
ls "${RUN_DIR}/output/images/"*.png 2>/dev/null | wc -l | xargs echo " PNG files:"
echo ""
echo "=== PPTX size ==="
du -h "${RUN_DIR}/output/presentation.pptx"
```

Expected output: all four files present, PNG count ≥ N scenes, PPTX > 100 KB (images embedded).

**Hard stop:** Present the output summary to the user and open the HTML preview in the default browser:

```bash
open "${RUN_DIR}/output/index.html"   # macOS
# xdg-open "${RUN_DIR}/output/index.html"  # Linux
```

Confirm with the user:
1. The HTML gallery shows all slides in the correct order.
2. `presentation.pptx` opens in PowerPoint/Keynote with editable text.
3. `speaker-notes.md` reads naturally as a teaching script.
4. `craft.md` is intact.

If any image appears blank in the PPTX (scene image missing), surface the specific `scene-{NN}` label and instruct the user to re-run Phase 4 for that scene only.

---

### `- [ ]` Step 2: Commit

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add commands/bible-class.md
git commit -m "$(cat <<'EOF'
feat(bible-class): Phase 5-6 PPTX assembly and delivery steps

HTML composer → PPTX conversion → HTML preview → speaker-notes → bundle
verification; adapts preview-template.html for PNG slides (not SVGs).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full Suite Verification

### `- [ ]` Step 1: Run all new tests

```bash
# Composer tests (ppt-agent)
cd /Users/kevinchen/PPT_Agent/ppt-agent
node --test skills/bible-class/test/html_compose.test.js

# Converter tests (ppt-agent-workflow-san)
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
node --test test/storybook_preset.test.js
node --test test/layout_storybook.test.js
node --test test/compose_pptx.test.js
```

Expected: All tests pass.

### `- [ ]` Step 2: End-to-end smoke test

Using a minimal synthetic `lesson-outline.json` (2 scenes, no real images — use a 1×1 px PNG stub):

```bash
# 1. Create a minimal run directory
RUN_DIR=$(mktemp -d)
mkdir -p "$RUN_DIR/images" "$RUN_DIR/master"

# 2. Write a stub PNG (1×1 red pixel)
python3 -c "
import struct, zlib
def make_png():
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b'\x00\xff\x00\x00')
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
open('/tmp/stub.png','wb').write(make_png())
"
cp /tmp/stub.png "$RUN_DIR/images/scene-01.png"
cp /tmp/stub.png "$RUN_DIR/images/scene-02.png"
cp /tmp/stub.png "$RUN_DIR/master/master-reference.png"

# 3. Write a minimal lesson-outline.json
cat > "$RUN_DIR/lesson-outline.json" <<'OUTLINE'
{
  "title": "主日学测试课",
  "scripture_ref": "约翰福音 3:16",
  "teaching": {
    "scenes": [
      {"index":1,"title":"第一幕","key_message":"神爱世人","narration":"神爱世人，甚至将他的独生子赐给他们。","interaction":"神怎样爱我们？","image_brief":"scene 1"},
      {"index":2,"title":"第二幕","key_message":"永生","narration":"叫一切信他的不至灭亡，反得永生。","interaction":"什么是永生？","image_brief":"scene 2"}
    ]
  },
  "craft": {},
  "memory_verse": {"text":"神爱世人，甚至将他的独生子赐给他们。","ref":"约翰福音 3:16"}
}
OUTLINE

echo "圣经主日学手工材料" > "$RUN_DIR/craft.md"

# 4. Compose HTML slides
node -e "
const { composeStorybookHtml } = require('./skills/bible-class/lib/html_compose');
const outline = JSON.parse(require('fs').readFileSync('$RUN_DIR/lesson-outline.json','utf8'));
const files = composeStorybookHtml({ outline, imagesDir: '$RUN_DIR/images', slidesDir: '$RUN_DIR/slides' });
console.log('HTML slides:', files.length);
" 

# 5. Convert to PPTX
mkdir -p "$RUN_DIR/output"
node /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js \
  --slides-dir "$RUN_DIR/slides" \
  --output "$RUN_DIR/output/presentation.pptx" \
  --dump-model "$RUN_DIR/output/slides-model.json" \
  --title "主日学测试课"

# 6. Verify outputs
ls -lh "$RUN_DIR/output/"
echo "PPTX size: $(du -h $RUN_DIR/output/presentation.pptx | cut -f1)"
echo "Model entries: $(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUN_DIR/output/slides-model.json','utf8')).length)")"
```

Expected:
- HTML compose step: `HTML slides: 4` (cover + 2 scenes + memory verse)
- PPTX step: `Wrote 4 slides → …/presentation.pptx`
- `presentation.pptx` exists and is > 30 KB (stub PNGs are tiny; still larger than empty)
- `slides-model.json` has 4 entries with correct `slideType` values

### `- [ ]` Step 3: Commit (if any fixup needed)

```bash
# Only if any fixup files were changed during smoke test
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add -p   # stage only changed files
git commit -m "$(cat <<'EOF'
fix(bible-class): smoke test fixups for PPTX delivery

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Design Decisions Forced by Existing Converter Structure

1. **One HTML per slide (not one combined HTML).** `html_to_pptx.js` calls a preset extractor that reads the entire HTML as a single slide model. Making it loop over `<section>` elements would require changing the extractor contract used by all presets. Instead, the composer writes N separate HTML files and `compose_pptx.js` iterates them, creating one call to `addStorybookSlide` per file. The `compose_pptx.js` orchestrator (new) owns the PptxGenJS instance and the loop.

2. **Renderer added to preset module, not to `html_to_pptx.js`.** The existing presets (`ai_runtime_preset.js`) export both `extract…` and `render…` (or `add…`) from the same file. `storybook_preset.js` follows this exact pattern: `extractStorybook` + `addStorybookSlide` are co-located. `html_to_pptx.js` dispatches to a thin wrapper (`runStorybook`) that delegates to `compose_pptx.js`.

3. **`--dump-model` on `compose_pptx.js` enables model-level testing.** Because we cannot assert on binary PPTX bytes, all tests assert on the extracted model object and the computed layout object. This mirrors how `html_to_pptx.js` supports `--dump-model <file.json>` for the AI Runtime preset — same pattern, carried over.

4. **HTML preview uses PNG `<img>` not SVG `<object>`.** The shared `preview-template.html` template uses `<object type="image/svg+xml">`. For storybook slides the slide content is fully rasterised PNG images; the preview JS code is adapted (via runtime string replacement in the generation step) to use `<img>` tags instead. The template file itself is **not modified** — the adaptation happens in the delivery script to keep the shared template clean.

---

## Self-Review (completed before plan is filed)

### Spec coverage

| Design Spec Item | Covered? | Notes |
|---|---|---|
| §2.2 Phase 5 HTML排版层 storybook版式 | Yes | `html_compose.js` generates full-bleed `<img>` + caption block |
| §2.2 Phase 5 HTML预览 | Yes | Task 6 Step 6.2 using preview-template.html with PNG adaptation |
| §2.2 Phase 5 可编辑PPTX via new storybook预设 | Yes | Tasks 2–5 |
| §2.2 Phase 5 不经过SVG | Yes | `addImage` puts raster PNG as picture object; no SVG path taken |
| §2.2 Phase 6 output/ bundle | Yes | Task 6 Steps 6.1–6.4 |
| §2.2 Phase 6 speaker-notes.md | Yes | Task 6 Step 6.3 |
| §2.2 Phase 6 craft.md独立交付 | Yes | Task 6 Step 6.4 |
| §2.3 RUN_DIR structure | Yes | Matches exactly |
| §2.11 PPTX文字溢出CJK | Yes | `fitFontSize` from `layout_utils.js` + preflight QA |
| Plan 1 conventions: CommonJS, node:test, no test deps | Yes | All new files |
| Plan 1 format: bite-sized 5-step TDD, complete code | Yes | Each task has failing test → impl → passing test |
| Converter preset registration (preset-template.md checklist) | Yes | Tasks 2–5 cover all 7 checklist items |

### Placeholder scan

No `TODO`, `TBD`, `FIXME`, `placeholder`, `...`, or `<your-value-here>` strings appear in any code block in this document. All paths are absolute. All function names are the real names from the actual source files.

### Type/name consistency

| Symbol | Used consistently in |
|---|---|
| `composeStorybookHtml` | `html_compose.js` export, test require, Phase 5 command |
| `renderSlideHtml` | internal helper, exported for potential reuse |
| `extractStorybook` | `storybook_preset.js` export, test require, `compose_pptx.js` |
| `addStorybookSlide` | `storybook_preset.js` export, `compose_pptx.js` render loop |
| `computeStorybookLayout` | `layout_storybook.js` export, `storybook_preset.js`, `preflight_qa.js` |
| `MAIN` | `layout_storybook.js`, `preflight_qa.js` (imported as `SB_MAIN`) |
| `fitFontSize` | `layout_utils.js` real exported name, used in `layout_storybook.js` |
| `assessBlock` / `assessSpacing` | `preflight_qa.js` real function names, reused in `storybookChecks` |
| `composePptx` / `buildModels` / `parseArgs` | `compose_pptx.js` exports, test require |
| `PRESET = 'storybook'` | `storybook_preset.js`, `html_to_pptx.js` detection, `preflight_qa.js` |
| `data-preset="storybook"` | HTML attribute written by composer, read by `detectPreset` in `html_to_pptx.js` |

### Cross-repo relationship

The two repos are entirely independent git repositories. There is no symlink, submodule, or shared `node_modules`. The delivery command in `commands/bible-class.md` references the workflow-san converter by **absolute path** (`/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js`). The converter's `node_modules` (cheerio, pptxgenjs) are installed in workflow-san and are not needed in ppt-agent for the composer module (`html_compose.js` uses only built-in `node:fs` and `node:path`).
