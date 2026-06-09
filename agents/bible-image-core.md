---
name: bible-image-core
description: "Orchestrates Phase 3-4 of /bible-class: style selection, master reference generation (hard stop), batch-parallel scene generation with one contact-sheet approval and selective redo"
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

**Resume guard (master already approved).** Before doing any Phase 3 work, check: if `<RD>/style.lock.json` exists with a **non-null `master_reference`** AND `<RD>/master/master-reference.png` exists, the master was already generated and approved in a prior run. In that case **SKIP Steps 2–6 entirely** (no preset reload, no `write_style_lock`, no master regeneration, no master Hard Stop) and **jump straight to Phase 4 (Step 7)**. Read `style_preset` and the identity/style blocks from the existing `style.lock.json` + `style.lock.identity.txt` / `style.lock.style.txt`; the `preset` / `character_desc` inputs are optional on this resume path. This makes the agent idempotent on the master so a `--run-id` resume continues into per-scene generation without redoing the定妆照.

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

### Step 8: Pre-generation cost estimate（整批）

对整批 N 个场景做一次成本预估并一次性征求同意：

```bash
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> --label scene-01 --out /dev/null \
  --prompt "x" --estimate-only --backend <current_backend>
```

将单张成本 × 场景数呈现给用户："预计生成 {N} 张场景图 × {单价}（backend={backend}）≈ {合计}。是否继续？"
用户拒绝则停止并报告；同意则进入 Step 9。

### Step 9: 并发生成全部场景图（一次性）

**9a. 写出所有 brief 文件。** 对每个场景（index `I`，`NN = pad2(I)`），把 `image_brief` 写入 `<RD>/briefs/scene-{NN}.txt`。

**9b. 构造 jobs 文件并并发生成。** 写一个 jobs JSON（每项是 `generate.run` 的 args，含 `--reference` 定妆照），调用 `generate_batch.js`：

```bash
# 用 Node 内联生成 jobs.json（label/out/promptFile/identityFile/styleFile/references）
node -e '
const fs=require("fs"), path=require("path");
const RD=process.argv[1];
const outline=JSON.parse(fs.readFileSync(path.join(RD,"lesson-outline.json"),"utf8"));
const scenes=outline.teaching.scenes.slice().sort((a,b)=>a.index-b.index);
const jobs=scenes.map(s=>{const nn=String(s.index).padStart(2,"0");return{
  runDir:RD, label:`scene-${nn}`, out:path.join(RD,"images",`scene-${nn}.png`),
  promptFile:path.join(RD,"briefs",`scene-${nn}.txt`),
  identityFile:path.join(RD,"style.lock.identity.txt"),
  styleFile:path.join(RD,"style.lock.style.txt"),
  references:[path.join(RD,"master","master-reference.png")],
  backend:"codex-cli"
};});
fs.writeFileSync(path.join(RD,"briefs","_jobs.json"), JSON.stringify(jobs,null,2));
console.log("jobs:",jobs.length);
' <RD>

node skills/image-gen/scripts/generate_batch.js --jobs-file <RD>/briefs/_jobs.json --concurrency 3
```

并发上限默认 3（codex-cli 后端较慢且有速率限制，3 是稳妥起点；若后端报速率错误，降到 2）。解析其 JSON 输出：对 `ok:false` 的场景记录失败 label。

**9c. 并行 bible_review。** 对每个成功生成的场景，仍按原 Step 9c 调 review-core（`mode=bible_review`）。可一次性把全部场景的 review 请求发出（SendMessage 各自独立），收齐后用 `parseReviewFlags` 汇总每个场景的 CRITICAL/MAJOR 标记。

**9d. 一次性 contact-sheet 审批（取代逐张审批）。** 生成一张联系表方便用户一眼看全（可用系统 `montage`/`sips` 或直接列路径）：

```bash
# 若安装了 ImageMagick：拼一张缩略图联系表
montage <RD>/images/scene-*.png -tile 3x -geometry 320x240+6+6 -title "Scenes" <RD>/images/_contact-sheet.png 2>/dev/null || echo "（未装 montage，请逐一 open 下列图片）"
```

向用户一次性呈现：
> "全部 {N} 张场景图已生成：`<RD>/images/_contact-sheet.png`（或逐张 `open <RD>/images/scene-NN.png`）。
> 各场景 bible_review 标记：{逐条列出 scene-NN: flags 或 none}。
> 请回复需要重做的场景编号 + 调整说明，例如：`redo 03 主角衣服颜色不对; redo 07 背景太暗`。
> 全部满意请回复 `approve`。"

**9R. 只重做被标记的场景（redo 循环）。** 用户给出重做列表时，对其中每个 scene-NN：调 `nextRedo(approvals, label)` 取新 redo 状态；若 `limitReached` 则警告这是最后一次。把这些（且仅这些）场景重新组成一个 jobs 文件，再次 `generate_batch.js`（并发同上），重做完对这些场景重跑 9c，回到 9d 再次一次性确认。循环至用户 `approve` 或全部到达 redo 上限。

**9f. 记录审批。** `approve` 后，对每个未被 skip 的场景写 `approvals[label]={approved:true,redoCount:N}`；被用户排除的写 `{approved:false,skipped:true}`。

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
