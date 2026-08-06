# Bible-Class 提速 + 丰富版式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `/bible-class` 两个问题——(A) 图片生成又慢（全串行+逐张人工确认，9 张 ~84 分钟）；(B) 成片版式糙（满屏黑蒙版/底部 80% 黑字幕条压住插画，显得"只有图片"）。

**Architecture:** 两个相互独立的子系统，可由两个 agent 并行实施。
- **Part A（提速）**：新增 `generate_batch.js`，用 Node 层并发池（默认并发 3）复用现有 `generate.js` 的 `run()` 同时生成多张场景图；改造 `bible-image-core` agent 的 Phase 4，由"逐张生成→逐张 review→逐张人工 approve"改为"全部并发生成→并行 bible_review→一次性 contact-sheet 审批→只重做被标记的场景"。场景图彼此只依赖同一张定妆照，互不依赖，故可安全并发。
- **Part B（版式）**：新增 `designed` preset（`layout_designed.js` + `designed_preset.js`），渲染"页眉条 + 大图主视觉 + 右侧要点卡 + 底部互动/金句装饰条"的丰富版式，配柔和童书配色，**不再用纯黑蒙版压暗插画**；`compose_pptx.js` 按 `data-preset` 分发；`html_compose.js` 改为输出 `designed` HTML 并携带 `key_points` / `scripture`。保留旧 `storybook` preset 与其测试不动（向后兼容）。

**Tech Stack:** Node.js (CommonJS)、PptxGenJS、cheerio、node:test（现有测试框架，见 `*.test.js`）。所有路径为绝对路径或相对各自仓库根。

**两个仓库：**
- 图片生成 + agent + 内容：`/Users/kevinchen/PPT_Agent/ppt-agent`
- PPTX 渲染器：`/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx`

**受众约束（贯穿 Part B）：** 受众是 3–5 岁、尚不识字的幼儿，**插画必须始终是视觉主角、足够大**；"要点/装饰条"是给带读老师的辅助，不得喧宾夺主。

---

## File Structure

**Part A（仓库 `ppt-agent`）**
- Create: `skills/image-gen/scripts/generate_batch.js` — 并发批量生成 CLI + 模块（复用 `generate.js` 的 `run`）
- Create: `skills/image-gen/test/generate_batch.test.js` — 并发/容错单测（注入 fake runner）
- Modify: `agents/bible-image-core.md` — Phase 4 改为并发生成 + 一次性审批

**Part B（仓库 `html-slide-to-pptx`，除 B5 外）**
- Create: `scripts/layout_designed.js` — 计算 designed 版式坐标/字号
- Create: `test/layout_designed.test.js`
- Create: `scripts/designed_preset.js` — 提取 designed 模型 + 渲染 PptxGenJS 形状
- Create: `test/designed_preset.test.js`
- Modify: `scripts/compose_pptx.js` — 按 `model.preset` 分发到 designed/storybook
- Modify: `test/compose_pptx.test.js` — 增加 designed 分发用例
- Modify（仓库 `ppt-agent`）: `skills/bible-class/lib/html_compose.js` — 输出 `data-preset="designed"` + 携带 `key_points`/`scripture`
- Modify（仓库 `ppt-agent`）: `skills/bible-class/test/...`（html_compose 相关测试）
- Modify（仓库 `ppt-agent`，B5 可选）: `skills/bible-class/lib/lesson_schema.js` — 场景新增可选字段 `key_points: string[]`

---

# Part A — 提速（图片并发生成 + 一次性审批）

## Task A1: 并发批量生成模块 `generate_batch.js`

**Files:**
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/image-gen/scripts/generate_batch.js`
- Test: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/image-gen/test/generate_batch.test.js`

设计：复用 `generate.js` 导出的 `run(args, deps)`。批量函数接受一组 job（每个 = 一次 `run` 的 args），用并发池（默认 3，可经 `--concurrency` 调整）同时跑，单个失败不拖垮整批（记为 `{ ok:false, error }`），最后返回每个 job 的结果数组，顺序与输入一致。`run` 的 `deps.runner` 可注入，便于测试。

- [ ] **Step 1: 写失败测试**

```js
// skills/image-gen/test/generate_batch.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { runBatch } = require('../scripts/generate_batch');

// 一个假的 generate.run：记录并发峰值，按 label 决定成功/失败
function makeFakeRun({ failLabels = [] } = {}) {
  let active = 0, peak = 0;
  const calls = [];
  async function fakeRun(args) {
    calls.push(args.label);
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--;
    if (failLabels.includes(args.label)) {
      throw new Error(`boom:${args.label}`);
    }
    return { imagePath: `${args.out}`, meta: { backend: 'fake' } };
  }
  return { fakeRun, calls, getPeak: () => peak };
}

test('runBatch 同时跑多个 job 且尊重并发上限', async () => {
  const jobs = Array.from({ length: 6 }, (_, i) => ({
    runDir: '/rd', label: `scene-0${i + 1}`, out: `/rd/images/scene-0${i + 1}.png`, prompt: 'x',
  }));
  const { fakeRun, getPeak } = makeFakeRun();
  const results = await runBatch(jobs, { concurrency: 3, runFn: fakeRun });

  assert.strictEqual(results.length, 6);
  assert.ok(results.every((r) => r.ok === true), '全部成功');
  assert.ok(getPeak() <= 3, `并发峰值应 <=3，实际 ${getPeak()}`);
  assert.ok(getPeak() >= 2, '应确实并发（>=2）');
});

test('runBatch 单个失败不影响其它，结果顺序与输入一致', async () => {
  const jobs = [
    { runDir: '/rd', label: 'scene-01', out: '/a.png', prompt: 'x' },
    { runDir: '/rd', label: 'scene-02', out: '/b.png', prompt: 'x' },
    { runDir: '/rd', label: 'scene-03', out: '/c.png', prompt: 'x' },
  ];
  const { fakeRun } = makeFakeRun({ failLabels: ['scene-02'] });
  const results = await runBatch(jobs, { concurrency: 2, runFn: fakeRun });

  assert.deepStrictEqual(results.map((r) => r.label), ['scene-01', 'scene-02', 'scene-03']);
  assert.strictEqual(results[0].ok, true);
  assert.strictEqual(results[1].ok, false);
  assert.match(results[1].error, /boom:scene-02/);
  assert.strictEqual(results[2].ok, true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/image-gen/test/generate_batch.test.js`
Expected: FAIL — `Cannot find module '../scripts/generate_batch'`

- [ ] **Step 3: 实现 `generate_batch.js`**

```js
// skills/image-gen/scripts/generate_batch.js
'use strict';
const fs = require('node:fs');
const { run } = require('./generate');

/**
 * 以固定并发上限运行一批生成 job。单个失败不影响整批。
 * @param {Array<object>} jobs  每项是 generate.run 的 args（含 label/out/prompt 或 promptFile 等）
 * @param {{concurrency?:number, runFn?:Function, deps?:object}} opts
 * @returns {Promise<Array<{label:string, ok:boolean, out?:string, error?:string}>>}
 *          顺序与 jobs 一致
 */
async function runBatch(jobs, opts = {}) {
  const concurrency = Math.max(1, opts.concurrency || 3);
  const runFn = opts.runFn || run;
  const deps = opts.deps || {};
  const results = new Array(jobs.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      const job = jobs[i];
      try {
        const res = await runFn(job, deps);
        results[i] = { label: job.label, ok: true, out: res.imagePath || job.out };
      } catch (err) {
        results[i] = { label: job.label, ok: false, error: String(err && err.message || err) };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseArgs(argv) {
  // --jobs-file <path>  指向一个 JSON 数组，每项是 generate.run 的 args
  // --concurrency <n>
  const a = { jobsFile: null, concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--jobs-file') { a.jobsFile = argv[++i]; }
    else if (argv[i] === '--concurrency') { a.concurrency = Number(argv[++i]) || 3; }
  }
  return a;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.jobsFile) {
    console.error('Usage: node generate_batch.js --jobs-file <jobs.json> [--concurrency 3]');
    process.exit(1);
  }
  const jobs = JSON.parse(fs.readFileSync(args.jobsFile, 'utf8'));
  runBatch(jobs, { concurrency: args.concurrency })
    .then((results) => {
      const failed = results.filter((r) => !r.ok);
      console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
      process.exit(failed.length > 0 ? 2 : 0);
    })
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { runBatch, parseArgs };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/image-gen/test/generate_batch.test.js`
Expected: PASS（2 个用例全过）

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/image-gen/scripts/generate_batch.js skills/image-gen/test/generate_batch.test.js
git commit -m "feat(image-gen): add concurrent batch generation (generate_batch.js)"
```

---

## Task A2: 改造 `bible-image-core` agent 的 Phase 4 为"并发生成 + 一次性审批"

**Files:**
- Modify: `/Users/kevinchen/PPT_Agent/ppt-agent/agents/bible-image-core.md`（Step 8–9 区段）

> 这是 agent 提示词（markdown）改动，没有单测；验证靠"实际跑一次 `/bible-class --run-id` 续跑并观察并发"。改动必须保持：定妆照仍是硬停审批、bible_review 仍对每个场景执行、redo 上限逻辑仍生效。

- [ ] **Step 1: 替换 Step 8（成本预估）措辞**——把"逐张"改为"整批"，无需逐张确认（保留一次成本预估硬停）。

将 `agents/bible-image-core.md` 中 `### Step 8: Pre-generation cost estimate` 整段替换为：

````markdown
### Step 8: Pre-generation cost estimate（整批）

对整批 N 个场景做一次成本预估并一次性征求同意：

```bash
node skills/image-gen/scripts/generate.js \
  --run-dir <RD> --label scene-01 --out /dev/null \
  --prompt "x" --estimate-only --backend <current_backend>
```

将单张成本 × 场景数呈现给用户："预计生成 {N} 张场景图 × {单价}（backend={backend}）≈ {合计}。是否继续？"
用户拒绝则停止并报告；同意则进入 Step 9。
````

- [ ] **Step 2: 用"并发生成"整段替换原 Step 9 的"逐张循环"**

将 `### Step 9: Per-scene loop ...` 直到 Step 9f 的全部内容，替换为下面的 Step 9 / Step 9R：

````markdown
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
````

- [ ] **Step 3: 同步更新顶部 description 与 Verification**——在 `agents/bible-image-core.md` 的 frontmatter `description` 里，把 "per-scene ... single-image redo loop" 改为 "batch-parallel scene generation with one contact-sheet approval and selective redo"。在文件末尾 "Before declaring Phase 4 complete" 清单保持不变（产物校验不变）。

- [ ] **Step 4: 人工走查（无自动化测试）**——通读改后段落，确认：(a) 定妆照硬停未被改动；(b) bible_review 仍对每个场景执行；(c) redo 上限逻辑（`nextRedo`/`limitReached`）仍被引用。

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add agents/bible-image-core.md
git commit -m "feat(bible-class): batch-parallel scene gen + one-shot contact-sheet approval"
```

---

# Part B — 丰富版式（designed preset）

## Task B1: designed 版式计算模块 `layout_designed.js`

**Files:**
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/layout_designed.js`
- Test: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/layout_designed.test.js`

幻灯片为 LAYOUT_WIDE：13.33 × 7.5 in。版式（scene 页）：
- 页眉条：y 0 → 0.72，全宽，柔和强调色；左=课程标题，右=经文出处
- 大图主视觉：x 0.45, y 0.95, w 7.25, h 5.55（圆角，约 54% 宽，仍是主角）
- 右侧栏 x 8.0, w 4.9：场景标题（y 0.95, h 1.0，大字）+ 要点卡（y 2.05, h 3.45）
- 底部互动条：y 6.62 → 7.3，全宽，强调色；💬 互动
- cover：大图 + **底部柔和渐变**（非纯黑蒙版）+ 居中标题/经文
- memory-verse：柔色卡片 + 大金句 + 出处

- [ ] **Step 1: 写失败测试**

```js
// test/layout_designed.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeDesignedLayout, GEO } = require('../scripts/layout_designed');

test('scene 版式：图是主角、有右栏与页眉/底栏', () => {
  const L = computeDesignedLayout({ slideType: 'scene', title: '海水分开了', body: '天父刮起大风，海水分开了。', subtext: '一起喊：过红海！', points: ['天父刮大风', '海水成两道墙'] });
  assert.ok(L.scene, '应返回 scene 段');
  // 图片宽度应是版面主角（>=50% 的 13.33）
  assert.ok(L.scene.imageW >= 6.6, `imageW=${L.scene.imageW} 应 >=6.6`);
  // 页眉与底栏存在且不重叠图片
  assert.ok(L.scene.headerH > 0 && L.scene.footerY > L.scene.imageY);
  // 标题字号在合理范围
  assert.ok(L.scene.titleFont >= 18 && L.scene.titleFont <= 36);
});

test('cover 版式：标题/经文有定位，字号合理', () => {
  const L = computeDesignedLayout({ slideType: 'cover', title: '红海分开了', body: '出埃及记 14' });
  assert.ok(L.cover && L.cover.titleFont >= 24);
});

test('memory-verse 版式：金句卡定位存在', () => {
  const L = computeDesignedLayout({ slideType: 'memory-verse', title: '我倚靠上帝，必不惧怕。', body: '诗篇 56:11' });
  assert.ok(L.verse && L.verse.titleFont >= 20);
});

test('GEO 常量导出且为 16:9 安全范围内', () => {
  assert.ok(GEO.imageX + GEO.imageW <= 13.33);
  assert.ok(GEO.footerY + GEO.footerH <= 7.5);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/layout_designed.test.js`
Expected: FAIL — `Cannot find module '../scripts/layout_designed'`

- [ ] **Step 3: 实现 `layout_designed.js`**

```js
// scripts/layout_designed.js
'use strict';
const { fitFontSize } = require('./layout_utils');

// 所有坐标单位为英寸。Slide = 13.33 × 7.5。
const GEO = {
  headerY: 0,    headerH: 0.72,
  imageX: 0.45,  imageY: 0.95,  imageW: 7.25,  imageH: 5.55,
  rightX: 8.00,  rightW: 4.90,
  titleY: 0.95,  titleH: 1.00,
  cardY:  2.05,  cardH:  3.45,  cardPad: 0.28,
  footerY: 6.62, footerH: 0.68, footerPad: 0.5,

  coverTitleY: 5.10, coverTitleH: 1.10, coverBodyGap: 0.18,
  verseCardX: 1.6, verseCardY: 1.5, verseCardW: 10.13, verseCardH: 4.5,
  verseTitleY: 2.1, verseTitleH: 2.6, verseRefGap: 0.3,
};

function computeDesignedLayout(model) {
  if (model.slideType === 'cover') {
    const titleFont = fitFontSize({ text: model.title, widthIn: 11.0, heightIn: GEO.coverTitleH, startSizePt: 44, minSizePt: 24, lineSpacing: 1.08, charFactor: 0.96 });
    const bodyFont = fitFontSize({ text: model.body, widthIn: 11.0, heightIn: 0.4, startSizePt: 20, minSizePt: 14, lineSpacing: 1.0, charFactor: 0.96 });
    return { cover: { titleY: GEO.coverTitleY, titleH: GEO.coverTitleH, titleFont, bodyY: GEO.coverTitleY + GEO.coverTitleH + GEO.coverBodyGap, bodyFont } };
  }

  if (model.slideType === 'memory-verse') {
    const titleFont = fitFontSize({ text: model.title, widthIn: GEO.verseCardW - 1.2, heightIn: GEO.verseTitleH, startSizePt: 40, minSizePt: 20, lineSpacing: 1.14, charFactor: 0.96 });
    const refFont = fitFontSize({ text: model.body, widthIn: GEO.verseCardW - 1.2, heightIn: 0.4, startSizePt: 18, minSizePt: 12, lineSpacing: 1.0, charFactor: 0.96 });
    return { verse: { titleY: GEO.verseTitleY, titleH: GEO.verseTitleH, titleFont, refY: GEO.verseTitleY + GEO.verseTitleH + GEO.verseRefGap, refFont } };
  }

  // scene
  const titleFont = fitFontSize({ text: model.title, widthIn: GEO.rightW, heightIn: GEO.titleH, startSizePt: 30, minSizePt: 18, lineSpacing: 1.04, charFactor: 0.97 });
  const points = Array.isArray(model.points) ? model.points : [];
  const pointsText = points.join('\n') || model.body || '';
  const pointsFont = fitFontSize({ text: pointsText, widthIn: GEO.rightW - 2 * GEO.cardPad, heightIn: GEO.cardH - 2 * GEO.cardPad, startSizePt: 20, minSizePt: 12, lineSpacing: 1.25, charFactor: 0.96 });
  const footerFont = fitFontSize({ text: model.subtext || '', widthIn: 13.33 - 2 * GEO.footerPad, heightIn: GEO.footerH - 0.12, startSizePt: 18, minSizePt: 12, lineSpacing: 1.0, charFactor: 0.96 });

  return {
    scene: {
      headerH: GEO.headerH,
      imageX: GEO.imageX, imageY: GEO.imageY, imageW: GEO.imageW, imageH: GEO.imageH,
      rightX: GEO.rightX, rightW: GEO.rightW,
      titleY: GEO.titleY, titleH: GEO.titleH, titleFont,
      cardY: GEO.cardY, cardH: GEO.cardH, cardPad: GEO.cardPad,
      pointsFont, points,
      footerY: GEO.footerY, footerH: GEO.footerH, footerFont,
    },
  };
}

module.exports = { computeDesignedLayout, GEO };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/layout_designed.test.js`
Expected: PASS（4 个用例全过）

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
git add scripts/layout_designed.js test/layout_designed.test.js
git commit -m "feat(pptx): add designed layout geometry module"
```

---

## Task B2: designed preset 渲染器 `designed_preset.js`

**Files:**
- Create: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/designed_preset.js`
- Test: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/designed_preset.test.js`

提供 `extractDesigned(htmlPath)`（读 `data-preset/data-slide-type/data-scripture`、`.caption-title/.caption-body/.caption-subtext`、`.caption-points li`、`.storybook-image img`）与 `addDesignedSlide(model, htmlDir, pptx)`（用 PptxGenJS 画页眉条/大图/右侧标题/要点卡/底部互动条；柔和童书配色，不压暗插画）。

> 测试用一个 fake pptx（记录 addText/addImage/addShape 调用），断言：场景页生成了图片 + 标题文本 + 要点文本 + 互动文本，且**没有覆盖全屏的深色蒙版**（即不存在 x:0,y:0,w:13.33,h:7.5 的深色 rect）。这把"又黑又压暗"作为回归项钉死。

- [ ] **Step 1: 写失败测试**

```js
// test/designed_preset.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractDesigned, addDesignedSlide } = require('../scripts/designed_preset');

function fakePptx() {
  const slides = [];
  return {
    ShapeType: { rect: 'rect', roundRect: 'roundRect' },
    addSlide() {
      const s = { _texts: [], _images: [], _shapes: [], background: null,
        addText(t, o) { this._texts.push({ t, o }); },
        addImage(o) { this._images.push(o); },
        addShape(type, o) { this._shapes.push({ type, o }); } };
      slides.push(s); return s;
    },
    _slides: slides,
  };
}

function writeDesignedHtml(dir, { type, title, body, subtext, scripture, points, img }) {
  const lis = (points || []).map((p) => `<li>${p}</li>`).join('');
  const imgBlock = img ? `<div class="storybook-image"><img src="${img}" alt="${title}"></div>` : '';
  const html = `<!DOCTYPE html><html><body data-preset="designed" data-slide-type="${type}" data-scripture="${scripture || ''}">
${imgBlock}<div class="storybook-caption"><h2 class="caption-title">${title}</h2>
<ul class="caption-points">${lis}</ul>
<p class="caption-body">${body || ''}</p><p class="caption-subtext">${subtext || ''}</p></div></body></html>`;
  const p = path.join(dir, `${type}.html`);
  fs.writeFileSync(p, html); return p;
}

test('extractDesigned 读出标题/要点/互动/经文/图片', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-'));
  const p = writeDesignedHtml(dir, { type: 'scene', title: '海水分开了', body: '天父刮起大风。', subtext: '一起喊：过红海！', scripture: '出埃及记 14', points: ['天父刮大风', '海水成墙'], img: 'a.png' });
  const m = extractDesigned(p);
  assert.strictEqual(m.preset, 'designed');
  assert.strictEqual(m.slideType, 'scene');
  assert.strictEqual(m.title, '海水分开了');
  assert.deepStrictEqual(m.points, ['天父刮大风', '海水成墙']);
  assert.strictEqual(m.subtext, '一起喊：过红海！');
  assert.strictEqual(m.scripture, '出埃及记 14');
  assert.strictEqual(m.imageSrc, 'a.png');
});

test('addDesignedSlide(scene) 画了图+标题+要点+互动，且无全屏深色蒙版', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-'));
  // 放一张占位图，保证 existsSync 通过
  fs.writeFileSync(path.join(dir, 'a.png'), 'x');
  const p = writeDesignedHtml(dir, { type: 'scene', title: '海水分开了', body: '天父刮起大风。', subtext: '一起喊：过红海！', scripture: '出埃及记 14', points: ['天父刮大风', '海水成墙'], img: 'a.png' });
  const model = extractDesigned(p);
  const pptx = fakePptx();
  addDesignedSlide(model, dir, pptx);
  const s = pptx._slides[0];

  assert.strictEqual(s._images.length, 1, '应有一张插画');
  // 图片宽度仍是主角
  assert.ok(s._images[0].w >= 6.6, '插画应足够大');
  const allText = s._texts.map((x) => String(x.t)).join(' | ');
  assert.match(allText, /海水分开了/, '有标题');
  assert.match(allText, /天父刮大风/, '有要点');
  assert.match(allText, /过红海/, '有互动');
  // 关键回归：不存在覆盖全屏的深色矩形蒙版
  const fullDark = s._shapes.some((sh) => sh.o && sh.o.w >= 13 && sh.o.h >= 7 && sh.o.x === 0 && sh.o.y === 0
    && sh.o.fill && /^(000000|0A0A0A|111111)$/i.test(String(sh.o.fill.color)) && (sh.o.fill.transparency || 0) < 50);
  assert.strictEqual(fullDark, false, '不应有全屏深色蒙版压暗插画');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/designed_preset.test.js`
Expected: FAIL — `Cannot find module '../scripts/designed_preset'`

- [ ] **Step 3: 实现 `designed_preset.js`**

```js
// scripts/designed_preset.js
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { computeDesignedLayout, GEO } = require('./layout_designed');

// 柔和童书配色：奶油底、深蓝字、暖橙强调
const COLORS = {
  pageBg:    'FBF7EF', // 奶油白页底（露在图片四周，柔和）
  header:    '163A5F', // 深蓝页眉/底栏
  headerText:'FFFFFF',
  accent:    'F4A259', // 暖橙强调
  title:     '1E3A5F', // 深蓝标题
  cardBg:    'FFFFFF', // 白要点卡
  cardLine:  'F4A259',
  pointText: '2B2B2B',
  footerText:'FFFFFF',
  verseCard: 'FFFFFF',
  verseText: '163A5F',
  coverScrim:'000000', // cover 仅底部小范围渐变用
};
const FONT_CN = 'PingFang SC';
const PRESET = 'designed';

function normalizeText(t) { return String(t || '').replace(/ /g, ' ').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function extractDesigned(htmlPath) {
  const $ = cheerio.load(fs.readFileSync(htmlPath, 'utf8'));
  const body = $('body');
  const slideType = normalizeText(body.attr('data-slide-type')) || 'scene';
  const scripture = normalizeText(body.attr('data-scripture'));
  const imgEl = $('.storybook-image img').first();
  const imageSrc = imgEl.length ? (imgEl.attr('src') || null) : null;
  const title = normalizeText($('.caption-title').first().text());
  const bodyText = normalizeText($('.caption-body').first().text());
  const subtext = normalizeText($('.caption-subtext').first().text());
  const points = $('.caption-points li').map((_, el) => normalizeText($(el).text())).get().filter(Boolean);
  return { preset: PRESET, slideType, imageSrc, title, body: bodyText, subtext, scripture, points };
}

function addDesignedSlide(model, htmlDir, pptx) {
  const L = computeDesignedLayout(model);
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.pageBg };

  if (model.slideType === 'cover') {
    if (model.imageSrc) {
      const abs = path.resolve(htmlDir, model.imageSrc);
      if (fs.existsSync(abs)) {
        slide.addImage({ path: abs, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: 'cover', w: 13.33, h: 7.5 } });
        // 仅底部一条柔和深色带（不压暗整张图）
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 4.4, w: 13.33, h: 3.1, fill: { color: COLORS.coverScrim, transparency: 35 }, line: { type: 'none' } });
      }
    }
    slide.addText(model.title, { x: 1.0, y: L.cover.titleY, w: 11.33, h: L.cover.titleH, fontFace: FONT_CN, fontSize: L.cover.titleFont, bold: true, color: COLORS.headerText, align: 'center', valign: 'middle', fit: 'none', margin: 0 });
    if (model.body) slide.addText(model.body, { x: 1.0, y: L.cover.bodyY, w: 11.33, h: 0.4, fontFace: FONT_CN, fontSize: L.cover.bodyFont, color: COLORS.accent, align: 'center', fit: 'none', margin: 0 });
    return { model, layout: L, slide };
  }

  if (model.slideType === 'memory-verse') {
    slide.addShape(pptx.ShapeType.roundRect, { x: GEO.verseCardX, y: GEO.verseCardY, w: GEO.verseCardW, h: GEO.verseCardH, rectRadius: 0.2, fill: { color: COLORS.verseCard }, line: { color: COLORS.accent, width: 2 } });
    slide.addText(model.title, { x: GEO.verseCardX + 0.6, y: L.verse.titleY, w: GEO.verseCardW - 1.2, h: L.verse.titleH, fontFace: FONT_CN, fontSize: L.verse.titleFont, bold: true, color: COLORS.verseText, align: 'center', valign: 'middle', fit: 'none', margin: 0 });
    if (model.body) slide.addText(model.body, { x: GEO.verseCardX + 0.6, y: L.verse.refY, w: GEO.verseCardW - 1.2, h: 0.4, fontFace: FONT_CN, fontSize: L.verse.refFont, color: COLORS.accent, align: 'center', fit: 'none', margin: 0 });
    return { model, layout: L, slide };
  }

  // scene
  const s = L.scene;
  // 页眉条
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: GEO.headerY, w: 13.33, h: s.headerH, fill: { color: COLORS.header }, line: { type: 'none' } });
  // 页眉左：课程标题（用 scripture 旁的上下文不一定有课程名，这里放经文出处作右侧；左侧放一个固定标识）
  if (model.scripture) slide.addText(model.scripture, { x: 0.5, y: 0, w: 8.0, h: s.headerH, fontFace: FONT_CN, fontSize: 14, color: COLORS.headerText, valign: 'middle', fit: 'none', margin: 0 });
  // 大图主视觉（圆角）
  if (model.imageSrc) {
    const abs = path.resolve(htmlDir, model.imageSrc);
    if (fs.existsSync(abs)) {
      slide.addImage({ path: abs, x: s.imageX, y: s.imageY, w: s.imageW, h: s.imageH, rounding: true, sizing: { type: 'cover', w: s.imageW, h: s.imageH } });
    }
  }
  // 右侧标题
  slide.addText(model.title, { x: s.rightX, y: s.titleY, w: s.rightW, h: s.titleH, fontFace: FONT_CN, fontSize: s.titleFont, bold: true, color: COLORS.title, valign: 'top', fit: 'none', margin: 0 });
  // 右侧要点卡
  slide.addShape(pptx.ShapeType.roundRect, { x: s.rightX, y: s.cardY, w: s.rightW, h: s.cardH, rectRadius: 0.12, fill: { color: COLORS.cardBg }, line: { color: COLORS.cardLine, width: 1.5 } });
  const bulletItems = (s.points && s.points.length ? s.points : [model.body].filter(Boolean));
  if (bulletItems.length) {
    slide.addText(bulletItems.map((p) => ({ text: p, options: { bullet: { code: '2022' }, breakLine: true } })), {
      x: s.rightX + s.cardPad, y: s.cardY + s.cardPad, w: s.rightW - 2 * s.cardPad, h: s.cardH - 2 * s.cardPad,
      fontFace: FONT_CN, fontSize: s.pointsFont, color: COLORS.pointText, lineSpacingMultiple: 1.25, valign: 'top', fit: 'none', margin: 0,
    });
  }
  // 底部互动条
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: s.footerY, w: 13.33, h: s.footerH, fill: { color: COLORS.accent }, line: { type: 'none' } });
  if (model.subtext) slide.addText(`💬 ${model.subtext}`, { x: GEO.footerPad, y: s.footerY, w: 13.33 - 2 * GEO.footerPad, h: s.footerH, fontFace: FONT_CN, fontSize: s.footerFont, bold: true, color: COLORS.footerText, valign: 'middle', fit: 'none', margin: 0 });

  return { model, layout: L, slide };
}

module.exports = { PRESET, extractDesigned, addDesignedSlide, COLORS, FONT_CN };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/designed_preset.test.js`
Expected: PASS（2 个用例全过）

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
git add scripts/designed_preset.js test/designed_preset.test.js
git commit -m "feat(pptx): add designed preset renderer (header + hero image + points card + interaction bar)"
```

---

## Task B3: `compose_pptx.js` 按 preset 分发

**Files:**
- Modify: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js:1-98`
- Modify: `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/test/compose_pptx.test.js`

`buildModels` 当前固定用 `extractStorybook`。改为先读 HTML 的 `data-preset`，designed → `extractDesigned`，否则 `extractStorybook`；`composePptx` 渲染时按 `model.preset` 调 `addDesignedSlide` 或 `addStorybookSlide`。

- [ ] **Step 1: 在 `test/compose_pptx.test.js` 增加 designed 分发用例**

```js
// 追加到 test/compose_pptx.test.js（沿用文件已有的 require/test 风格）
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composePptx } = require('../scripts/compose_pptx');

test('composePptx 识别 designed preset 并产出 pptx', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
  fs.writeFileSync(path.join(dir, 'a.png'), 'x');
  const slide = path.join(dir, 'slide-01.html');
  fs.writeFileSync(slide, `<!DOCTYPE html><html><body data-preset="designed" data-slide-type="scene" data-scripture="出埃及记 14">
<div class="storybook-image"><img src="a.png" alt="t"></div>
<div class="storybook-caption"><h2 class="caption-title">海水分开了</h2>
<ul class="caption-points"><li>天父刮大风</li><li>海水成墙</li></ul>
<p class="caption-body">天父刮起大风。</p><p class="caption-subtext">一起喊：过红海！</p></div></body></html>`);
  const out = path.join(dir, 'out.pptx');
  const models = await composePptx({ slides: [slide], output: out });
  assert.strictEqual(models[0].preset, 'designed');
  assert.ok(fs.existsSync(out), '应生成 pptx 文件');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/compose_pptx.test.js`
Expected: FAIL — designed slide 被当成 storybook 提取，`models[0].preset` 不是 `'designed'`（或断言不通过）

- [ ] **Step 3: 修改 `compose_pptx.js`**

将顶部 require（第 6 行）改为：

```js
const { extractStorybook, addStorybookSlide } = require('./storybook_preset');
const { extractDesigned, addDesignedSlide } = require('./designed_preset');
const cheerio = require('cheerio');
const fsRead = require('fs');
```

将 `buildModels`（第 56–64 行）替换为：

```js
function detectPreset(htmlPath) {
  const $ = cheerio.load(fsRead.readFileSync(htmlPath, 'utf8'));
  return ($('body').attr('data-preset') || 'storybook').trim();
}

function buildModels(htmlPaths) {
  return htmlPaths.map((p) => {
    if (!fsRead.existsSync(p)) throw new Error(`compose_pptx: slide file not found: ${p}`);
    const preset = detectPreset(p);
    const model = preset === 'designed' ? extractDesigned(p) : extractStorybook(p);
    model.preset = preset;
    model.htmlPath = p;
    model.htmlDir = path.dirname(p);
    return model;
  });
}
```

将 `composePptx` 的渲染循环（第 86–88 行）替换为：

```js
  for (const model of models) {
    if (model.preset === 'designed') {
      addDesignedSlide(model, model.htmlDir, pptx);
    } else {
      addStorybookSlide(model, model.htmlDir, pptx);
    }
  }
```

- [ ] **Step 4: 运行全部 PPTX 测试确认通过且无回归**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx && node --test test/`
Expected: PASS — 新 designed 用例过，且 `compose_pptx.test.js`/`storybook_preset.test.js`/`layout_storybook.test.js` 全部仍过（向后兼容）

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx
git add scripts/compose_pptx.js test/compose_pptx.test.js
git commit -m "feat(pptx): dispatch slide rendering by data-preset (designed|storybook)"
```

---

## Task B4: `html_compose.js` 输出 designed HTML（携带 key_points / scripture）

**Files:**
- Modify: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/lib/html_compose.js:34-127`
- Test: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/test/`（新建或追加 `html_compose.test.js`）

让 `renderSlideHtml` 接受 `preset`（默认 `designed`）、`scripture`、`points`，输出 `data-preset` / `data-scripture` 与 `<ul class="caption-points">`。`composeStorybookHtml` 透传：cover 的 scripture = `outline.scripture_ref`；scene 的 points = `scene.key_points`（可选，缺省回退为 `[scene.key_message]` 再缺省为 `[]`），scripture = `outline.scripture_ref`。

> 该 preset 名映射的是渲染器，不强依赖内容是否有 `key_points`；无 `key_points` 时要点卡回退展示 key_message 或 narration（渲染器侧已处理 fallback），不报错。

- [ ] **Step 1: 写失败测试**

```js
// skills/bible-class/test/html_compose.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composeStorybookHtml, renderSlideHtml } = require('../lib/html_compose');

test('renderSlideHtml 默认输出 designed preset + 要点 + 经文', () => {
  const html = renderSlideHtml({ type: 'scene', title: '海水分开了', body: '天父刮起大风。', subtext: '一起喊：过红海！', scripture: '出埃及记 14', points: ['天父刮大风', '海水成墙'] });
  assert.match(html, /data-preset="designed"/);
  assert.match(html, /data-scripture="出埃及记 14"/);
  assert.match(html, /<ul class="caption-points">/);
  assert.match(html, /<li>天父刮大风<\/li>/);
});

test('composeStorybookHtml 把 scene.key_points 写进 designed HTML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
  const imagesDir = path.join(dir, 'images');
  const slidesDir = path.join(dir, 'slides');
  fs.mkdirSync(imagesDir, { recursive: true });
  const outline = {
    title: '红海分开了', scripture_ref: '出埃及记 14',
    teaching: { scenes: [
      { index: 1, title: '辛苦做苦工', key_message: '以色列人做苦工', narration: '每天搬砖头。', interaction: '累不累呀？', key_points: ['搬重砖头', '做得慢会挨打'] },
    ] },
  };
  const written = composeStorybookHtml({ outline, imagesDir, slidesDir });
  const sceneHtml = fs.readFileSync(written.find((p) => p.endsWith('slide-01.html')), 'utf8');
  assert.match(sceneHtml, /data-preset="designed"/);
  assert.match(sceneHtml, /<li>搬重砖头<\/li>/);
  assert.match(sceneHtml, /data-scripture="出埃及记 14"/);
});

test('缺 key_points 时回退到 key_message，不报错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
  const imagesDir = path.join(dir, 'images');
  const slidesDir = path.join(dir, 'slides');
  fs.mkdirSync(imagesDir, { recursive: true });
  const outline = { title: 'x', scripture_ref: 'y', teaching: { scenes: [
    { index: 1, title: 't', key_message: '关键句', narration: 'n', interaction: 'i' },
  ] } };
  const written = composeStorybookHtml({ outline, imagesDir, slidesDir });
  const sceneHtml = fs.readFileSync(written.find((p) => p.endsWith('slide-01.html')), 'utf8');
  assert.match(sceneHtml, /<li>关键句<\/li>/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/bible-class/test/html_compose.test.js`
Expected: FAIL — 当前输出 `data-preset="storybook"`、无 `caption-points`

- [ ] **Step 3: 修改 `html_compose.js`**

将 `renderSlideHtml`（第 34–51 行）替换为：

```js
function renderSlideHtml({ type, title, body, imageSrc, subtext, scripture, points, preset = 'designed' }) {
  const imgBlock = imageSrc
    ? `  <div class="storybook-image">\n    <img src="${esc(imageSrc)}" alt="${esc(title)}">\n  </div>\n`
    : '';
  const pointsList = Array.isArray(points) ? points.filter(Boolean) : [];
  const pointsBlock = pointsList.length
    ? `    <ul class="caption-points">\n${pointsList.map((p) => `      <li>${esc(p)}</li>`).join('\n')}\n    </ul>\n`
    : '';
  const subtextBlock = subtext
    ? `    <p class="caption-subtext">${esc(subtext)}</p>\n`
    : '';
  const scriptureAttr = scripture ? ` data-scripture="${esc(scripture)}"` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${esc(title)}</title></head>
<body data-preset="${esc(preset)}" data-slide-type="${esc(type)}"${scriptureAttr}>
${imgBlock}  <div class="storybook-caption">
    <h2 class="caption-title">${esc(title)}</h2>
${pointsBlock}    <p class="caption-body">${esc(body)}</p>
${subtextBlock}  </div>
</body>
</html>`;
}
```

在 `composeStorybookHtml` 里给三处 `renderSlideHtml` 调用补字段：

cover（第 86–91 行）增加 `scripture: outline.scripture_ref || ''`：

```js
  fs.writeFileSync(coverPath, renderSlideHtml({
    type: 'cover',
    title: outline.title || '主日学课程',
    body: outline.scripture_ref || '',
    imageSrc: coverImgSrc,
    scripture: outline.scripture_ref || '',
  }), 'utf8');
```

scene（第 99–105 行）增加 points 回退 + scripture：

```js
    const points = (Array.isArray(scene.key_points) && scene.key_points.length)
      ? scene.key_points
      : (scene.key_message ? [scene.key_message] : []);
    fs.writeFileSync(slidePath, renderSlideHtml({
      type: 'scene',
      title: scene.title || '',
      body: scene.narration || '',
      imageSrc: imgSrc,
      subtext: scene.interaction || '',
      scripture: outline.scripture_ref || '',
      points,
    }), 'utf8');
```

memory-verse（第 115–119 行）保持默认 preset=designed 即可，无需 points/scripture。

- [ ] **Step 4: 运行测试确认通过 + 跑既有 bible-class 测试无回归**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/bible-class/test/`
Expected: PASS（新 html_compose 用例过；若既有测试断言了 `data-preset="storybook"` 字面值，需同步更新为 `designed`——这是预期的兼容性调整）

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/html_compose.js skills/bible-class/test/html_compose.test.js
git commit -m "feat(bible-class): emit designed-preset HTML with key_points and scripture"
```

---

## Task B5（可选，内容更丰富时启用）: 场景 schema 新增可选 `key_points`

**Files:**
- Modify: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/lib/lesson_schema.js:101-120`
- Test: `/Users/kevinchen/PPT_Agent/ppt-agent/skills/bible-class/test/`（schema 相关测试）

让校验**接受**可选的 `scene.key_points: string[]`（存在则必须是字符串数组），缺省不报错。这样内容生成（content-core 写 outline 时）可逐场景给 2–3 条要点，渲染更丰富；老 outline 不带该字段也通过校验。

- [ ] **Step 1: 写失败测试**

```js
// 追加到既有 lesson_schema 测试文件
test('scene.key_points 可选：是字符串数组时通过', () => {
  // 复用文件里既有的 validateOutline / makeValidOutline 辅助；若无则内联一个最小合法 outline
  const outline = makeValidOutline();
  outline.teaching.scenes[0].key_points = ['要点一', '要点二'];
  const { errors } = validateOutline(outline);
  assert.deepStrictEqual(errors, []);
});

test('scene.key_points 若存在但非字符串数组则报错', () => {
  const outline = makeValidOutline();
  outline.teaching.scenes[0].key_points = '不是数组';
  const { errors } = validateOutline(outline);
  assert.ok(errors.some((e) => /key_points/.test(e)));
});
```

> 若该测试文件没有 `makeValidOutline`/`validateOutline` 辅助，先在文件顶部按既有用例的 outline 结构内联一个最小合法 outline（含 `title`/`scripture_ref`/`teaching.scenes[0]` 的 `title|key_message|narration|interaction|image_brief|index`）。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/bible-class/test/`
Expected: FAIL — 第二个用例期望报错但当前 schema 忽略未知字段

- [ ] **Step 3: 在场景校验循环里加 key_points 校验**

在 `lesson_schema.js` 的 `t.scenes.forEach((scene, i) => { ... })` 循环内（第 101–115 行附近，紧接 index 校验之后）加入：

```js
        if ('key_points' in scene) {
          if (!Array.isArray(scene.key_points) || scene.key_points.some((x) => typeof x !== 'string')) {
            errors.push(`${prefix}.key_points must be an array of strings when present`);
          }
        }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/kevinchen/PPT_Agent/ppt-agent && node --test skills/bible-class/test/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
git add skills/bible-class/lib/lesson_schema.js skills/bible-class/test/
git commit -m "feat(bible-class): accept optional scene.key_points (string[]) in outline schema"
```

> B5 落地后，可在 content-core 生成 outline 的提示词里要求每个场景给 2–3 条 `key_points`（动宾短句、幼儿可懂）。该提示词改动不在本计划范围，建议作为后续小改单独处理。

---

# 端到端验证（两部分都实现后）

用昨天那次真实运行的数据，**只重渲染、不重生成图片**，即可对比版式改善：

```bash
cd /Users/kevinchen/PPT_Agent/ppt-agent
RD=openspec/changes/bc-red-sea-parted
# 1) 重新合成 designed HTML（覆盖 slides/）
node -e '
const {composeStorybookHtml}=require("./skills/bible-class/lib/html_compose");
const fs=require("fs"); const RD=process.argv[1];
const outline=JSON.parse(fs.readFileSync(RD+"/lesson-outline.json","utf8"));
composeStorybookHtml({outline, imagesDir:RD+"/images", slidesDir:RD+"/slides"});
console.log("HTML 重新合成完成");
' $RD
# 2) 用 designed preset 重新合成 pptx
node ../ppt-agent-workflow-san/html-slide-to-pptx/scripts/compose_pptx.js \
  --slides-dir $RD/slides --output $RD/output/presentation.pptx \
  --dump-model $RD/output/slides-model.json --title "红海分开了"
open $RD/output/presentation.pptx
```

**人工验收清单：**
- [ ] 场景页插画清晰、未被深色蒙版压暗，且仍是版面主角（≥半幅）
- [ ] 每页有页眉经文条、右侧标题、要点卡（要点或 key_message）、底部 💬 互动条
- [ ] 封面只有底部柔和渐变、标题清楚；金句页是柔色卡片
- [ ] 文字未溢出、未被图片遮挡
- [ ] （提速）一次 `/bible-class` 续跑可观察到多张图并发生成、单次 contact-sheet 审批

---

## Self-Review（计划作者已自查）

- **Spec coverage：** 问题 A（慢）→ Task A1（并发模块）+ A2（agent 一次性审批）；问题 B（差/只有图片）→ B1–B4（designed 版式渲染全链路）+ B5（可选内容增强）。两问题均有对应任务。
- **Placeholder scan：** 无 TBD/“稍后实现”；每个代码步骤给出完整可运行代码与确切命令、预期输出。
- **Type consistency：** `runBatch(jobs, {concurrency,runFn})` 在 A1 定义并在 A2 经 `--jobs-file` 调用一致；`computeDesignedLayout`/`GEO`（B1）被 `designed_preset.js`（B2）按相同字段名消费；`extractDesigned`/`addDesignedSlide`（B2）被 `compose_pptx.js`（B3）按相同签名调用；HTML 契约（`data-preset="designed"`、`data-scripture`、`.caption-points li`、`.caption-title/.caption-body/.caption-subtext`）在 B2 提取端与 B4 生成端一致。
- **独立性：** Part A（image-gen 仓库）与 Part B（pptx 渲染 + bible-class 内容）无共享文件，可由两个 agent 并行实施；B3 依赖 B1/B2，B4 依赖 B2 的 HTML 契约，故 Part B 内部顺序为 B1→B2→B3→B4→(B5)。
