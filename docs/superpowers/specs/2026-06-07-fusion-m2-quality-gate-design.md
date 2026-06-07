# Fusion M2 — 质量门控 设计（spec）

> 类型:设计文档(spec)。下一步用 writing-plans 转成可执行计划。
> 上游:`FUSION_PLAN.md` Phase 3 / `FUSION_PLAN_REVIEW.md` P2 / 基线 `2026-06-07-fusion-m2-baseline-results.md`。
> 里程碑入口:`docs/superpowers/FUSION_ROADMAP.md`。

## 0. 核心执行原则(本里程碑及后续一律遵循)

**全貌用活的路线图(`FUSION_ROADMAP.md`,里程碑粒度),落地用即时的详细计划(临执行前用 writing-plans 一个个写)。**

详细计划保鲜期短——写得离执行越远,越会被执行推翻(本主线停滞的根因正是一份过早写死的大计划;本会话每做一步认知就被修正一次)。因此:
- **不**一次性预写所有里程碑的详细计划。
- M2 自身也按此节奏:本 spec → 一份 M2 plan → 子代理 TDD 执行 → review → **回头更新 `FUSION_ROADMAP.md`** → 下一个里程碑。
- 每当认知被推翻(如本里程碑发现"reviewer 已带上下文"),立即回改路线图与相关 spec。

---

## 1. 背景与现状(已核实,别重复造)

- 编排是 `commands/ppt.md` 的散文 + 嵌入 bash,由 Claude Code 宿主解释。7 阶段:1 Init·2 研究(Hard Stop)·3 取材·4 大纲(Hard Stop)·5 策划稿·6 设计+审查·7 交付(Hard Stop)。
- **`review-core` 现已读 style YAML + outline.json**(title/context),并把 index/title/style 传给 Gemini;`reviewer.md` **已有按页型密度目标**(Content Density Targets 表)。
- **缺口**:per-slide `mode=review` 的 prompt 传了 title 却**没传该页 `type`**(只 holistic 模式读 `type`/`visual_weight`)→ 逐页审查时按页型的密度判定靠 Gemini 猜,非确定给定。
- **完全没有**:任何对 `outline.json` 的结构化校验器;`density-targets` 是 markdown 表(无机器可读单一来源)。
- `outline.json` 每页字段(来自 `outline-architect.md`,单一来源):`index, title, subtitle, type(content|data|comparison|process|quote|image), layout_type(10 选,见 bento-grid-layout.md), visual_weight(low|medium|high), key_points[], data_elements, notes`;`key_message` 在 **part 级**;`cover.type`、`end_page.type(thank_you|call_to_action|contact|q_and_a)`。
- 约定:core 逻辑 Node/TS;`node:test`(每 skill 自带 package.json+test/);markdown 用 grep 测试;直提 main。

> ⚠️ 基线修正:P0 复审均分 7.49/10 **偏低**——因测量时未传 style+页型,而生产 review-core 是传的。真值由本里程碑 **Task 1** 给出。

---

## 2. 范围

**本份 M2 做(E+C+D + Task 1)**:
- **C** `planning_validator`(Node):Phase 4 大纲后校验 `outline.json`。
- **E** reviewer 页型上下文:per-slide `mode=review` 补传 `type`(+`visual_weight`)。
- **D** 方法论嵌入:workflow-san method 原则进 `outline-architect.md`。
- **Task 1**:用户在插件会话跑一次带埋点 12 页,补首轮通过率/修复轮次真值。

**刻意不做(留下一份切片或后续里程碑)**:
- **B** 语义策划稿审查门控(`review-core mode=planning_review`)——更重,下一切片。
- **F** `narrative-rhythm.md` / `pipeline-compat.md` 参考文档。
- **P3** 排版 7 级阶梯 + 60/30/10 配色——独立里程碑。

---

## 3. 组件 C:planning_validator(中心件)

### 3.1 定位与位置
纯逻辑 Node 模块,跑在 **Phase 4(content-core `mode=outline` 产出 `outline.json`)之后、向用户出大纲 Hard Stop 之前**。把质量检查**左移到便宜的大纲阶段**,在出 SVG 之前抓住问题。

### 3.2 文件
- `skills/_shared/scripts/lib/planning-validator.js` — 纯校验逻辑,无 I/O(传入已解析的 outline 对象 + density 表)。
- `skills/_shared/scripts/planning-validator-cli.js` — 薄 CLI:读 `--outline <path>`,读 density-targets,打印 JSON 报告;exit 0=无硬错误,exit 1=有硬错误(供散文判断)。
- `skills/_shared/references/density-targets.json` — 从 `reviewer.md` Content Density Targets 表**逐字抽取**的机器可读单一来源。
- `skills/_shared/test/planning-validator.test.js` — `node:test` 富单测。
- 接线:`commands/ppt.md` Phase 4。

### 3.3 校验项

**硬错误(BLOCK → 让 lead 用 content-core `mode=revise` 修,再校)**:
- `outline.json` 合法 JSON;必填顶层字段:`title, total_pages, approved, cover, parts, end_page`。
- 每页必填:`index, title, type, layout_type, visual_weight, key_points`(`key_points` 须为数组)。
- enum 合法:`type ∈ {content,data,comparison,process,quote,image}`;`layout_type ∈` bento 10 选;`visual_weight ∈ {low,medium,high}`;`cover.type`、`end_page.type` 在各自集合。
- `index` 从 1 连续无缺无重;`total_pages` == 实际页数 且落在 `input.md` 的 `--pages` 区间。

**软警告(不阻塞;在 Phase 4 Hard Stop 的 AskUserQuestion 里**一并呈现给用户**,由用户决定改不改)**:
- **密度(确定性)**:每页 `len(key_points)` 对照 density-targets 的 `max_key_points`。超出即警告;若 `len(key_points)` 超 `target_info_units.max + 2` → 标 `major`;cover/quote `key_points>0` 或单元>3 → 标 `critical`(对应 reviewer.md 规则)。用**显式 key_points 计数**,不做模糊"信息单元"估算。
- **布局多样性**:连续 >3 页相同 `layout_type` → 警告(对应 reviewer.md 单调性规则)。
- **visual_weight 节奏**:连续 >3 页 `high` → 警告(对应 FUSION 密度交替节奏)。
- **part-level key_message 缺失** → 警告(M2 方法论要求每节有明确论点)。

### 3.4 density-targets.json(逐字来自 reviewer.md,DRY 单一来源)
结构(键 = 页型;reviewer.md 的 `timeline` 行是布局键,不在 page-type enum,作为可选键保留并注明):
```json
{
  "cover":      { "target_info_units": [2,3], "max_key_points": 0 },
  "quote":      { "target_info_units": [1,2], "max_key_points": 0 },
  "image":      { "target_info_units": [1,2], "max_key_points": 0 },
  "content":    { "target_info_units": [3,5], "max_key_points": 3 },
  "data":       { "target_info_units": [4,7], "max_key_points": 2 },
  "comparison": { "target_info_units": [4,6], "max_key_points": 3 },
  "process":    { "target_info_units": [3,5], "max_key_points": 5 },
  "timeline":   { "target_info_units": [3,6], "max_key_points": 6 }
}
```
- `reviewer.md` 的密度表改为"**数值见 `density-targets.json`**"的指针,消除双源漂移(reviewer 是 markdown,引用即可;planning-validator 是 import)。
- comparison 的 "2-3 per column"、process 的 "3-5 steps" 等口语化上限,取其整数上限作 `max_key_points`(comparison=3、process=5),在 JSON 注释/spec 注明取整规则。

### 3.5 输出:`${RUN_DIR}/planning-validation.json`
```json
{
  "ok": false,
  "hard_errors": [ { "page": 3, "field": "layout_type", "msg": "invalid enum 'grid' (allowed: single_focus, ...)" } ],
  "warnings": [
    { "page": 4, "kind": "density", "severity": "major", "msg": "5 key_points exceeds data max 2 by >2" },
    { "kind": "layout_diversity", "msg": "pages 3-6 all 'two_column_symmetric' (>3 consecutive)" }
  ],
  "summary": { "pages": 12, "hard_errors": 1, "warnings": 2 }
}
```
- `ok=false` 当且仅当存在 hard_errors。lead 据此:有硬错→content-core revise 重来;仅软警→把 warnings 摘要塞进 Phase 4 的 AskUserQuestion 选项说明,用户可"照旧/让我调"。

### 3.6 散文接线(ppt.md Phase 4)
在 content-core `mode=outline` 产出 outline.json 之后、第 2 步 AskUserQuestion 之前,加一步:
```bash
node skills/_shared/scripts/planning-validator-cli.js \
  --outline "${RUN_DIR}/outline.json" \
  --targets skills/_shared/references/density-targets.json \
  --pages "${PAGES}" > "${RUN_DIR}/planning-validation.json"
```
- exit 1(硬错)→ 不出大纲给用户,先 content-core `mode=revise` 修,再校,直到 exit 0。
- exit 0 + 有 warnings → 在大纲 Hard Stop 里把 warnings 摘要展示给用户。
- 无 Node → 跳过校验(优雅降级),散文注明"未校验"。

---

## 4. 组件 E:reviewer 页型上下文(小)

### 4.1 改动
- `agents/review-core.md` `mode=review`:在读 outline.json 那步,额外取该页的 `type` 与 `visual_weight`,并把它们写进传给 gemini-cli 的 prompt 的 "Slide Context"(今天只有 index/title/style)。
- `commands/ppt.md` Phase 6 的 review-core 派发说明同步注明传 `type`。
- reviewer.md **无需改**(它已有按页型密度目标;只是现在能确定拿到页型)。

### 4.2 效果
逐页审查时,reviewer 的 Content Density Targets 按**给定页型**判定(封面按 2-3、data 按 4-7…),不再靠 Gemini 从 SVG 猜 → 消除封面/尾页被当普通内容页低估的偏差(正是 P0 基线 7.49 偏低的来源之一)。

---

## 5. 组件 D:方法论嵌入(便宜)

### 5.1 改动
在 `skills/_shared/references/prompts/outline-architect.md` 的指导部分嵌入 workflow-san `method.md` 三条核心(用项目既有中文风格):
- **从问题开始,不从模板开始**——先明确"这套要回答什么问题",再排页。
- **内容先行,设计后行**——大纲只定内容与论点,不预设视觉效果。
- **每节有明确论点**——每个 part 的 `key_message`、每页"这一页想说明什么"必须显式(与 C 的 part-level key_message 软警告呼应)。

### 5.2 测试
`skills/_shared/test/outline-architect.test.js`(grep 结构测试):断言三条原则关键短语存在于 outline-architect.md(非恒真:删掉任一条该测失败)。

---

## 6. Task 1:带埋点基线生成(用户在插件会话跑)

**为什么必须用户跑**:`/ppt` 全流程依赖插件专属 agent(research/content/slide/review-core)+ 3 个交互 Hard Stop,只有加载了 ppt-agent 插件的 Claude Code 会话能驱动;本仓库会话的通用 agent 跑不了。

**计划里给用户的确切动作**:
1. 在插件会话执行(建议跳交付以省时):
   `/ppt-agent:ppt --pages=12 --stop-at=design 帮我做一套新一代小米SU7发布会的PPT`
2. 跑完保留 `${RUN_DIR}/review-manifest.json`(含每页 `final_score`、`fix_rounds`、`status`)。
3. 把该文件路径/内容回贴。

**回收的真值**(写回 `fusion-m2-baseline-results.md`):
- 生成期**首轮通过率** = `fix_rounds==0 的页 / 总页`。
- **平均修复轮次** = Σ`fix_rounds`/总页。
- **忠实 Gemini 均分**(生产管线、带 style+页型,修正 7.49)。
- 据此把 M2 提升目标**相对实测基线**定死(替换 v3 臆造值)。

**注意**:Task 1 是 M2 plan 的第 1 个任务,但由用户执行,**不阻塞** C/E/D 的开发(它们可并行先做;目标值在 Task 1 数据到位后填入)。

---

## 7. 测试策略
- **planning-validator**:`node:test` 富单测——每条硬错误(坏 JSON、缺字段、各 enum 非法、index 断裂/重复、total_pages 不符/越界)各一例;每条软警告(密度 max_key_points 超标、major 阈值、cover/quote critical、布局连续>3、visual_weight 连续>3、part 缺 key_message)各一例;一个"干净 outline → ok:true 无警告"正例。用一个**最小合法 outline fixture** 驱动。
- **density-targets.json**:一个测试断言 8 个页型键齐全、数值与 reviewer.md 表一致(防漂移)。
- **CLI**:exit-code 契约(有硬错 exit 1、无硬错 exit 0)各一例(沿用 stop-at-cli 的 execFileSync 测法)。
- **ppt.md / review-core.md / outline-architect.md**:grep 结构测试(Phase 4 调 planning-validator-cli;mode=review 传 type;三条方法论原则在位),且做**空洞性自检**(删除对应内容该测应失败)。

## 8. 验收标准
- planning-validator 全单测过;对一份故意构造的坏 outline 报出全部硬错误且 exit 1;对干净 outline ok:true。
- density-targets.json 与 reviewer.md 表数值一致;reviewer.md 改为指针无重复数值。
- review-core mode=review 的 prompt 确定包含该页 `type`。
- outline-architect.md 含三条方法论原则,grep 测试守护。
- Phase 4 接线:硬错→revise 循环;软警→Hard Stop 呈现;无 Node→优雅跳过。
- Task 1 数据到位后,M2 目标值以实测基线表达(首轮通过率/修复轮次/Gemini 均分)。

## 9. 自审(本 spec)
- 占位符:无 TBD;density 数值逐字来自 reviewer.md。
- 一致性:页型 enum 在 C/E/density-targets 三处一致;`key_points` 计数是 C 密度检查的确定性依据(非模糊估算)。
- 范围:聚焦 E+C+D+Task1;B/F/P3 明确划出。
- 歧义:density 软警告阈值明确(超 max_key_points→warn;超 target max+2→major;cover/quote 特例→critical);comparison/process 口语上限取整规则已注明。
