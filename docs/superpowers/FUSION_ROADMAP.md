# Fusion 主线路线图(活文档)

> **这是一份活文档**——随每个里程碑的执行而更新,不是一次写死的计划。
> **核心执行原则**:**全貌用活的路线图(本文件,里程碑粒度),落地用即时的详细计划(临执行前用 writing-plans 一个个写)。** 详细计划保鲜期短——写得离执行越远,越会被执行推翻(本主线停滞的根因正是一份过早写死的大计划)。所以本文件只到里程碑粒度;每个里程碑临做时才产出带 TDD 步骤/完整代码的 plan。
> 维护:每完成一个里程碑、或认知被推翻时,回来改本文件。
> 上游:战略 `FUSION_PLAN.md`;独立审核 `FUSION_PLAN_REVIEW.md`;进度记忆 `fusion-mainline-progress`。
> 最近更新:2026-06-07(M1 完成、M2 brainstorm 完成)。

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
| **M2** | **质量门控** | 🔵 **进行中** | planning_validator + reviewer 页型上下文 + 方法论嵌入 | P0 |
| P3 | 排版 + 配色 | ⚪ 待办 | 7 级字号阶梯 + 60/30/10 配色校验 | M2 |
| P4 | 资源注入 | ⚪ 待办 | Akxan 资源库 + Node assembler 按需注入 | M2;Akxan(已核实) |
| P5 | PPTX 导出 | ⚪ 待办 | 方案 D MVP + 统一 ppt/export + 复用 storybook | bible-class Plan4 更佳 |
| P6 | 智能配图 | ⚪ 待办 | 复用 skills/image-gen(Plan1 已完成) | Plan1 ✅ |
| P7 | core 抽离 + MCP | ⚪ 待办 | core/(Node/TS)+ MCP server,大重构 | 最后做 |

**当前推荐顺序**:M2 →(B/F 收尾切片,可选)→ P3 → P5(方案D MVP)→ P4 → P6 → P7。

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

## 进行中

### M2 — 质量门控 🔵(brainstorm 完成,spec 待写)
**范围(第一份)**:
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
- **布局枚举大清理**(M2 brainstorm 发现):`layout_type` 命名在 outline-architect(5 选 `layout_hint`)/content-core(10 选 snake_case)/bento-grid-layout(人读标题)三处不一致。M2 只对齐了 outline-architect 的 JSON 示例;跨全部消费方(slide-core 等)统一为单一 10 选枚举 + validator 升级为硬校验,留作独立小任务。
