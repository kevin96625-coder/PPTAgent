# Fusion 主线路线图(活文档)

> **这是一份活文档**——随每个里程碑的执行而更新,不是一次写死的计划。
> **核心执行原则**:**全貌用活的路线图(本文件,里程碑粒度),落地用即时的详细计划(临执行前用 writing-plans 一个个写)。** 详细计划保鲜期短——写得离执行越远,越会被执行推翻(本主线停滞的根因正是一份过早写死的大计划)。所以本文件只到里程碑粒度;每个里程碑临做时才产出带 TDD 步骤/完整代码的 plan。
> 维护:每完成一个里程碑、或认知被推翻时,回来改本文件。
> 上游:战略 `FUSION_PLAN.md`;独立审核 `FUSION_PLAN_REVIEW.md`;进度记忆 `fusion-mainline-progress`。
> 🔴 **明天入口 / 最新发现**:`docs/superpowers/2026-06-07-dogfood-findings-and-next-steps.md`(M2 完成 + 真实 dogfood 实测 + 下一步)。
> 最近更新:2026-06-07(M1 完成、M2 代码完成、真实 12 页 dogfood 跑完 → 发现瓶颈在 slide-core,新增 M2.5 里程碑)。

---

## 横切事实(所有里程碑通用,已被本会话核实)

- **语言**:新增 core 逻辑用 **Node/TS**(审核 F5),与 image-gen/bible-class/gemini-cli 统一。**不要**用 Python。
- **测试约定**:纯逻辑 `node:test`(每 skill 自带 `package.json`+`test/`);markdown/prose 用 grep 结构测试。
- **Gemini**:评审走**本地 gemini CLI + OAuth 订阅(无需 API key)**;`invoke-gemini-ppt.ts` 已修 `--skip-trust`(否则非信任目录静默降级)。
- **PPTX 最优解**:原帖亲口说 SVG 可直接拖进 Office 2016+ 可编辑;**方案 D(SVG 原生嵌入)** 应作 M4 MVP;Akxan 自带 `svg2pptx.py` 可评估移植。
- **Akxan/ppt-agent-skill**:已核实**公开、MIT**,含 `references/charts|styles|typography|bento-grid|principles/`;移植需署名;assembler 仍自建。
- **协作**:本地仓库,**直提 main、不开分支**;bible-class 是垂直试验田,跑通的范式回灌通用 /ppt。

---

## 里程碑总图

| # | 里程碑 | 状态 | 一句话 | 依赖 |
|---|--------|------|--------|------|
| P0 | 基线 + 源核实 | ✅ 完成 | 实测基线、核实 Akxan、修 Gemini bug | — |
| M1 | `--stop-at` 灵活性 | ✅ 完成 | 分阶段停止 + 复用 --run-id 恢复 | P0 |
| **M2** | **质量门控** | ✅ 代码完成 + 真实 dogfood 验证 | planning_validator + reviewer 页型上下文 + 方法论嵌入 | P0 |
| **M2.5** | **🔴🔴 生成与视觉质量(战略 brainstorm 先行)** | ⚪ **下一个(优先于 P3)** | 真实图片 vs 禁假插画 · 谁出 SVG(Gemini?)· HTML 产物线 · 审查补"资产/内容贴切"维度;含 slide-core 机械硬化(安全区/14px/对比度自修) | M2(dogfood 实测:产物不可用 + 审查虚假高分) |
| P3 | 排版 + 配色 | ⚪ 待办 | 7 级字号阶梯 + 60/30/10 配色校验(14px floor 被 M2.5 覆盖) | M2.5 |
| P4 | 资源注入 | ⚪ 待办 | Akxan 资源库 + Node assembler 按需注入 | M2;Akxan(已核实) |
| P5 | PPTX 导出 | ⚪ 待办 | 方案 D MVP + 统一 ppt/export + 复用 storybook | bible-class Plan4 更佳 |
| P6 | 智能配图 | ⚪ 待办 | 复用 skills/image-gen(Plan1 已完成) | Plan1 ✅ |
| P7 | core 抽离 + MCP | ⚪ 待办 | core/(Node/TS)+ MCP server,大重构 | 最后做 |

**当前推荐顺序**:M2 ✅ → **M2.5 slide-core 硬化(下一个,实测驱动)** → P3 → P5(方案D MVP)→ P4 → P6 → P7。(B/F 收尾切片可选,插在任意处。)

### 🔴🔴 M2.5 — 生成与视觉质量(下一个里程碑,战略 brainstorm 先行)
**动因(看渲染产物后,头号)**:真实 12 页跑出的 deck **质量差、无法使用**(第 3 页是手绘通用轿跑剪影,与 SU7 无关;全 deck 零真实图;Gemini 却给 8.2/全过 = **审查盲区造成虚假信心**)。**这比机械违规更根本——机械硬化不会让丑/错的插画变好。**
**战略取舍(brainstorm,结合原帖 + 两项目优点)**:
- 真实图片(image-gen/P6)接产品/封面页 vs 禁止 slide-core 画假产品插画(改抽象/图标化);
- 谁出 SVG:Claude 手绘 Bento vs 原帖式 **Gemini 出整页 SVG**;
- 要不要 HTML 产物线(原帖"非编辑用 HTML 更丰富" + workflow-san HTML→PPTX 真保真);
- reviewer 补"资产质量/内容贴切/专业度"维度 or 更早人工预览门。
**含(次级)机械硬化**:slide-core 生成后**确定性自修**——安全区钳位(标题基线≥~92)、字号 <14 抬到 14、对比度修正;SVG 层补密度防线;review-core 效率(截断/重审、`node` 替 `npx tsx`、瘦身 prompt)。机械目标:首轮通过率 58%→≥85%、修复轮次 0.8→≤0.3。
**🔴 明天入口/详见**:`docs/superpowers/2026-06-07-dogfood-findings-and-next-steps.md`。

---

## 已完成里程碑(摘要 + 认知修正)

### P0 — 基线 + 源核实 ✅
`docs/.../2026-06-07-fusion-00-baseline-and-source-check.md` + `...-fusion-m2-baseline-results.md`
- 排版违规率已 **0%**(14px 下限已强制);密度超标 **7%**(卡片定义,均 5.2 单元/页)
- Gemini 复审均分 **7.49/10**(⚠️ 偏低:测时未传 style+页型;真值由 M2 Task1 给)
- **Akxan 真实存在(MIT)**;附带发现 `svg2pptx.py`(改写 P5 策略)
- **修正 F3**:Akxan 从"未核实风险"→"可移植依赖"

### M1 — `--stop-at` ✅
`docs/.../2026-06-07-fusion-01-stop-at.md`,子代理 TDD,**28 测试全过**,11 commit。
纯决策逻辑 `skills/_shared/scripts/lib/stop-at.js` + CLI + ppt.md 散文接线(Phase 1 决策、Phase 3–6 检查点、共享提前交付段),保留无 Node 散文降级。

---

## 进行中 / 近完成

### M2 — 质量门控 ✅ 代码完成(2026-06-07,基线 Task0 待用户跑)
子代理 TDD,**58 测试全过**;spec `2026-06-07-fusion-m2-quality-gate-design.md`、plan `2026-06-07-fusion-m2-quality-gate.md`。
已交付:`density-targets.json`(单一来源)、`planning-validator.js`+CLI(Phase 4 门控:硬错阻塞/软警提示/3 轮封顶/无 Node 降级)、review-core 传页型(含封面/尾页查找)、outline-architect schema 对齐 + 方法论嵌入。
**剩 Task 0(用户)**:插件会话跑 `--pages=12 --stop-at=design` 一次,回贴 review-manifest.json → 补首轮通过率/修复轮次真值、修正 7.49。
**范围(第一份,已实现)**:
- **C planning_validator**(Node,`_shared`):Phase 4 大纲后校验 outline.json——硬错误(JSON/enum/字段/index)阻塞;软警告(密度/布局多样性/visual_weight 节奏)在 Hard Stop 提示。密度目标抽到共享 `density-targets.json`(与 reviewer 共用)。
- **E reviewer 页型上下文**:per-slide `mode=review` 补传 `type`(+visual_weight),让 reviewer 已有的按页型密度目标确定生效。
- **D 方法论嵌入**:workflow-san method 原则进 outline-architect.md。
- **Task 1(你跑)**:插件会话跑一次带埋点 12 页,保留 review-manifest.json → 补首轮通过率 + 修复轮次真值。
**关键修正(brainstorm 发现)**:reviewer 其实**已带** style+outline 上下文,E 比原设想小得多;原以为的"reviewer 缺上下文"主要是我基线测量的捷径造成的。

**本里程碑刻意推迟到下一份**:
- **B** 语义策划稿审查门控(review-core `mode=planning_review`)——更偏 LLM 语义、设计更重
- **F** 参考文档(`narrative-rhythm.md`、`pipeline-compat.md`)

---

## 待办里程碑(里程碑粒度,临执行再出详细 plan)

### P3 — 排版 + 配色
- 7 级字号阶梯(H1–Micro);社区反馈:Body 最低 14→16px、Caption ≥14px
- 60/30/10 配色比例:style YAML 加 `color_ratio`,slide-core/review-core 加校验
- 注:排版违规率基线已 0%,本里程碑重在阶梯规范 + 配色比例,排版部分是"加规范"非"补缺口"
- 来源校正:7 级字号/60-30-10 **非原帖**,标"通用设计规范/待复核",勿挂原帖

### P4 — 资源注入
- 从 Akxan(MIT,署名)移植 `references/` 资源内容(charts/styles/typography/bento/principles)
- **assembler 自建**(Node):按需注入,每页 ≤3000 tokens(prompt_assembler 概念,Akxan 无此文件)
- 往现成 `_shared/index.json` 注册表加 charts/blocks/principles 域(非从零建注册表)

### P5 — PPTX 导出
- **先实测 Akxan `svg2pptx.py` 吃 Bento Grid SVG 的保真度**,再定方案 D(原生嵌入,MVP)vs 移植 A(逐元素可编辑)
- 弃用方案 C(Puppeteer,违背可移植性)
- 统一 `ppt/export` 门面:输入 SVG→方案D,输入 HTML→复用 bible-class storybook(路线甲)

### P6 — 智能配图
- 复用 `skills/image-gen` 的 `generate.js` CLI 契约(flags/manifest/--redo/参考图角色一致性)
- 融入技法来源需重标(非原帖)

### P7 — core 抽离 + MCP
- 把散在 `commands/ppt.md` 的编排抽成 core/(Node/TS)+ MCP server
- **大重构(10+ 天)**:先抽纯逻辑(artifacts/quality/workflow 状态机)→ 再包 MCP
- 最后做

---

## 收尾切片(M2 之后,P3 之前可选)
- **B** review-core `mode=planning_review`:语义评 页面目标↔key_message 一致性 / 信息层级 / 证据充足度
- **F** `_shared/references/narrative-rhythm.md`(10/15/20 页模板)+ `pipeline-compat.md`(浏览器/dom-to-svg/OOXML 三层、SVG 安全子集)
- **布局 / 页型枚举大清理**(M2 brainstorm + 审查发现):① `layout_type` 命名在 outline-architect(原 5 选 `layout_hint`)/content-core(10 选 snake_case)/bento-grid-layout(人读标题)三处不一致——M2 只对齐了 outline-architect 的 JSON 示例。② `timeline` 在 JSON `"type"` 枚举里**不是** page type(只 6 选),但 outline-architect 的 "Page Type Definitions" 表又把它列为页型——validator 按 6 选硬校验(与 content-core 实际产出一致)。跨全部消费方统一布局枚举 + 厘清 timeline 是 layout 非 type + validator 相应升级,留作独立小任务。
