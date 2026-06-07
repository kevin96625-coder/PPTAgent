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
