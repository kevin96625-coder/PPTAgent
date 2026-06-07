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
