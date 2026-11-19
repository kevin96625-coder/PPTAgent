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
  "character_age": "string (主角在本课事件中的准确年龄，由 content-core 联网查 scripture_ref 后填写，含简短经文依据。例如: \"约30岁（路加福音3:23 耶稣开始传道时约三十岁）\" / \"12岁男孩（路加福音2:42）\" / \"婴儿（马太福音2:1-2）\" / \"60-80岁老年（使徒行传7:23,30 摩西40岁逃米甸、80岁领百姓出埃及）\"。是 character_profile.age_appearance 的冗余快照，向后兼容用)",
  "character_profile": {
    "character_name": "string (第一主角姓名，由 content-core 从 lesson-source.json 识别后填写，如 耶稣/大卫/摩西/彼得)",
    "age_appearance": "string (第一主角在本课事件中的年龄外观，联网查经得出，同 character_age)",
    "ethnicity": "string (第一主角的民族/地域，基于圣经历史背景，如 1世纪犹太/近东地区)",
    "hair_description": "string (头发/胡须描述，基于历史背景合理推断)",
    "clothing": "string (服装描述，基于历史背景合理推断，如 亚麻及踝长袍、皮凉鞋)",
    "palette": "string (配色方案，温暖柔和的色调)"
  },
  "characters": {
    "<role_key>": {
      "character_name": "string (角色姓名，如 耶稣/盲人/撒该；群体角色如 十位麻風病人)",
      "role": "string (main=第一主角 | supporting=重要配角)",
      "reference_kind": "string (可选: group=群体角色，生成一张群体合影定妆照)",
      "group_size": "number (可选: 群体人数，如 10)",
      "age_appearance": "string",
      "ethnicity": "string",
      "hair_description": "string",
      "clothing": "string",
      "palette": "string"
    }
  },
  "characters_order": ["<role_key>", "..."],
  "note: characters": "由 content-core 识别第一主角 + 跨≥2场出现且有动作/对话的重要配角(如盲人、撒该、拉撒路)。跨≥2场出现的确定群体(如路加福音17的十個麻瘋病人)作为一个 group 角色条目(reference_kind=group)，生成群体合影定妆照以保证跨场景同一群人。匿名人群(门徒、群众、小朋友)不进 characters，留在 image_brief 自由发挥。character_profile 是 characters 第一主角项的快照，向后兼容。",
  "teaching": {
    "duration_min": 15,
    "scenes": [
      {
        "index": 1,
        "title": "string",
        "key_message": "string",
        "key_points": ["string (2-3条，每条幼儿可懂的动宾短句，用作右侧要点卡，如：天父刮大风 / 海水成两道墙)"],
        "narration": "string (3-5岁口语旁白)",
        "interaction": "string (互动提问)",
        "image_brief": "string (画面描述，供生图。定妆照主角为中性neutral表情，此处需根据场面给主角补上轻量情绪词，如微笑、严肃、心疼、惊讶、困惑等，禁止夸张情绪。例如：摩西严肃地高举木杖伸向海面)",
        "characters": ["role_key (本场景出场的角色 key 列表，对应 characters 映射的 key。如 [\"jesus\"] 或 [\"jesus\",\"blindman\"]。生图时只传这些角色的定妆照。若本场景无 characters 里的角色(如纯人群场景)，可留空数组，将只传第一主角定妆照)"]
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

4. **Resume detection** (when `--run-id` is provided — evaluate top to bottom, **most specific first**):
   - `style.lock.json` exists with a **non-null `"master_reference"`** AND `images/` does **not** yet contain one PNG per scene → **resume at Phase 4** (the master was already approved; **reuse `master/master-reference.png`, do NOT re-run Phase 3 style selection or master generation**). On this path, skip Step 3.1/3.2 (style + character are already in `style.lock.json`) and invoke `bible-image-core` with `run_dir` only — the agent detects the approved master and goes straight to per-scene generation (see its resume guard).
   - `lesson-outline.json` with `"approved": true` (and master **not** yet approved) → skip to Phase 3 (style selection + image generation).
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

   👤 角色清单（已查经，将分别生成定妆照）：
      主角：{character_profile.character_name}，{character_profile.age_appearance}
      配角：{for each supporting character in characters: character_name, role}
      ⚠️ 请确认主角身份/年龄准确，以及配角识别是否合理（跨≥2场、有戏份的具名/半具名角色才进清单；匿名门徒/群众不应在此）。
      例：约翰福音9 = 主角耶稣 + 配角盲人。若不对，请在大纲修改反馈里说明。

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

## Phase 3: Style Selection + Master Reference (Hard Stop)

**Purpose:** Lock the visual style and generate the master character reference image (定妆照). This master reference will be used as `--reference` input for ALL scene images in Phase 4 to ensure cross-scene character consistency.

**Inputs consumed:**
- `${RUN_DIR}/lesson-outline.json` (approved, contains `teaching.scenes[]`)
- `${RUN_DIR}/lesson-source.json` (for theological context)

**Outputs produced:**
- `${RUN_DIR}/style.lock.json`
- `${RUN_DIR}/style.lock.identity.txt`
- `${RUN_DIR}/style.lock.style.txt`
- `${RUN_DIR}/master/master-reference.png` (after approval)

### Step 3.1 — Style Selection

Present the 4 available child-friendly styles to the teacher using `AskUserQuestion`:

```
🎨 请选择课程插图风格：

1️⃣ **扁平卡通** (Flat Cartoon) — 默认推荐
   明亮、圆润的2D卡通风格，粗黑边线，饱和色彩
   适合：大多数圣经故事，神学上最易控制

2️⃣ **水彩绘本** (Watercolor Storybook)
   柔和的水彩插画，温暖笔触，宁静叙事氛围
   适合：温柔或沉思性的场景

3️⃣ **皮克斯3D** (Disney 3D)
   友好的3D动画风格，柔和光线，高视觉冲击力
   适合：活泼场景，需谨慎控制神学表达

4️⃣ **温暖手绘** (Warm Handdrawn)
   蜡笔和粗马克笔手绘风格，活力四射，欢快氛围
   适合：欢乐或积极的场景

---
请输入数字 (1-4)，或回复风格英文名。不输入则默认选择 1 (Flat Cartoon)。
```

Map the user's choice to the preset name:
- `1` or `flat-cartoon` → `flat-cartoon`
- `2` or `watercolor-storybook` → `watercolor-storybook`
- `3` or `disney-3d` or `pixar-3d` → `disney-3d`
- `4` or `warm-handdrawn` → `warm-handdrawn`
- Empty or invalid → default to `flat-cartoon`

Store the choice in a shell variable: `STYLE_PRESET=<preset>`

### Step 3.2 — Character Description

Ask the teacher to describe the main character (usually Jesus, but could be another biblical figure):

```
👤 请描述主要圣经角色（通常是耶稣）：

我需要以下信息来生成角色定妆照：
- **角色名称**：如"耶稣"
- **外观年龄**：如"30岁左右"
- **民族/地域**：如"1世纪犹太/近东"
- **头发**：如"棕色齐肩波浪卷发，短胡须"
- **服装**：如"米色/奶油色及踝长袍，棕色皮凉鞋"
- **配色方案**：如"温暖米色、奶油色、棕色、柔和蓝"

---
可以直接回复"默认耶稣"使用标准描述，或逐项提供自定义描述。
```

**Age resolution (重要):** Before asking the teacher, read `lesson-outline.json`'s top-level
`character_age` field (set in Phase 2 by content-core's scripture lookup). If it is non-empty,
use it as `age_appearance` — do NOT fall back to the 30-year-old default. This is how the
scripture-grounded age flows from the outline into the master reference. Only when
`character_age` is empty/missing should you fall back to the defaults below.

If the user replies "默认耶稣" or similar, use the default character description:

```json
{
  "character_name": "耶稣",
  "age_appearance": "30岁左右",
  "ethnicity": "1世纪犹太/近东地区",
  "hair_description": "棕色齐肩波浪卷发，短胡须",
  "clothing": "米色/奶油色及踝长袍，棕色皮革凉鞋",
  "palette": "温暖米色、奶油色、棕色、柔和蓝"
}
```

Otherwise, parse the user's custom description into the same JSON structure. If any required field is missing, ask for it explicitly. In all cases, prefer `character_age` from the outline over any hardcoded default for the age.

Store the character description JSON in a shell variable or temp file:
```bash
CHARACTER_DESC_JSON='<JSON_STRING>'
```

### Step 3.3 — Invoke bible-image-core (Single Call for Phase 3 + 4)

Call the `bible-image-core` agent via `Task`. This single invocation will internally complete:
- Phase 3: style lock + master reference generation + master hard stop (agent uses `AskUserQuestion` directly)
- Phase 4: per-scene generation loop with character consistency (all scenes use `--reference` to master)

```text
Task(subagent_type="ppt-agent:bible-image-core",
     prompt="run_dir=${RUN_DIR} preset=${STYLE_PRESET} character_desc=${CHARACTER_DESC_JSON}")
```

**What the agent does internally (no second call needed):**

**Phase 3 execution inside agent:**
1. Call `skills/bible-class/scripts/write_style_lock.js` to write `style.lock.json` + sidecar `.txt` files.
2. Write `${RUN_DIR}/briefs/master.txt` with a master-reference brief (derived from `character_desc`).
3. Generate `${RUN_DIR}/master/master-reference.png` via `skills/image-gen/scripts/generate.js` (NO `--reference` flag for master).
4. **HARD STOP**: Agent uses `AskUserQuestion` to present master image to teacher for approval/redo. Teacher approves/redos directly with agent (no command-layer relay needed).
5. On approval: agent updates `style.lock.json` with `"master_reference": "master/master-reference.png"`.

**Phase 4 execution inside agent (after master approved):**
6. Read `lesson-outline.json` and extract `teaching.scenes[]`.
7. For each scene (sorted by `index`):
   a. Write `${RUN_DIR}/briefs/scene-{NN}.txt` from `image_brief`.
   b. Call `skills/image-gen/scripts/generate.js` with:
      ```
      --run-dir ${RUN_DIR}
      --label scene-{NN}
      --out ${RUN_DIR}/images/scene-{NN}.png
      --prompt-file ${RUN_DIR}/briefs/scene-{NN}.txt
      --identity-file ${RUN_DIR}/style.lock.identity.txt
      --style-file ${RUN_DIR}/style.lock.style.txt
      --reference ${RUN_DIR}/master/master-reference.png    ← KEY: ensures character consistency
      ```
   c. Call `review-core` agent (mode=bible_review) to check for anachronisms, theological accuracy, reverence.
   d. Present each scene image + review to teacher for approval (agent uses `AskUserQuestion` directly).
   e. If teacher requests redo: re-run generation with `--redo` flag (up to 3 retries per scene via `redo_state.js`).
   f. If scene exhausts retries or backend fails: write a placeholder entry in `image-manifest.json` with `"status": "missing"`, do NOT fake the image.

**Expected agent signals:**
- `heartbeat` — at the start of Phase 3, Phase 4, and each scene (progress tracking).
- `bible-image-core-done` — final signal when all scenes processed. Includes JSON payload:
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

### Step 3.4 — Wait for bible-image-core-done

Wait for the agent to send `bible-image-core-done` signal. This indicates:
- Master reference approved and locked in `style.lock.json`.
- All scenes processed (mix of approved + missing allowed).
- `image-manifest.json` written with status for every scene.

If the agent sends `error` signal, surface the error message to the teacher and stop.

---

## Phase 4: Verify Scene Images (Post bible-image-core)

**Purpose:** After the single `bible-image-core` call completes (which internally ran Phase 3 master + Phase 4 scenes), verify the image artifacts and count successful vs. missing scenes before proceeding to PPT assembly.

**Inputs consumed (produced by bible-image-core):**
- `${RUN_DIR}/style.lock.json` (with locked `master_reference`)
- `${RUN_DIR}/master/master-reference.png` (approved master)
- `${RUN_DIR}/images/scene-{NN}.png` (one per approved scene)
- `${RUN_DIR}/bible-reviews/review-{NN}.md` (theological reviews)
- `${RUN_DIR}/image-manifest.json` (status for every scene: approved or missing)

### Step 4.1 — Verify image manifest

After Phase 4 completes, check `${RUN_DIR}/image-manifest.json` to count successful vs. missing scenes:

```bash
TOTAL_SCENES=$(node -e "const o=JSON.parse(require('fs').readFileSync('${RUN_DIR}/lesson-outline.json','utf8')); console.log(o.teaching.scenes.length);")
GENERATED_SCENES=$(ls ${RUN_DIR}/images/scene-*.png 2>/dev/null | wc -l | xargs)
MISSING_SCENES=$((TOTAL_SCENES - GENERATED_SCENES))

echo "📊 场景生成统计："
echo "   总场景数：${TOTAL_SCENES}"
echo "   成功生成：${GENERATED_SCENES}"
echo "   缺失/失败：${MISSING_SCENES}"
```

If `MISSING_SCENES > 0`, warn the teacher:
```
⚠️  警告：有 ${MISSING_SCENES} 个场景图片未能生成（后端失败或重试耗尽）。
   最终 PPT 中这些场景将使用占位符或跳过。
   可选操作：检查 ${RUN_DIR}/image-manifest.json 查看失败原因，或稍后重跑 Phase 4。
```

If `GENERATED_SCENES == 0`, stop and report:
```
❌ Phase 4 失败：所有场景图片生成失败。无法继续到 Phase 5（PPT 组装）。
   请检查：
   1. image-gen 后端是否可用（Gemini API 凭证等）
   2. lesson-outline.json 的 image_brief 是否合理
   3. ${RUN_DIR}/image-manifest.json 中的错误日志
```

### Step 4.2 — Print Phase 4 completion summary

If at least one scene was generated successfully:

```
✅ Phase 4 完成：场景插图生成
📊 成功生成：${GENERATED_SCENES} / ${TOTAL_SCENES} 场景
🖼️  图片目录：${RUN_DIR}/images/
📄 生成清单：${RUN_DIR}/image-manifest.json
🔍 神学审核：${RUN_DIR}/bible-reviews/
---
✨ 角色一致性已通过 --reference 机制确保（所有场景使用同一 master 参考图）
下一步：Phase 5 — PPT 组装
```

Proceed to Phase 5.

---

## Phase 5 — PPT Assembly

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

## Phase 6 — Delivery

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
