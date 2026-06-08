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
| **M2.5** | **🔴🔴 真实图片 + 视觉可用性门** | ✅ **代码完成(2026-06-08,子代理 TDD,97 测试全过)** | 混合图源(品牌实体联网搜图 / 抽象走 image-gen)· slide-core 放开 `<image>`+图主导版式 · 视觉审查(渲染→Gemini 看图,资产维度)· 人工预览门(样片+候选图,样片在前批量在后)。**剩**:用户在插件会话跑一次真实 dogfood 验证产物质量。 | M2(dogfood:产物不可用 + 审查虚假高分) |
| **M2.6** | **机械自修(确定性)** | ✅ **代码完成(2026-06-08,子代理 TDD,125 测试)** | svg-autofix:字号下限/暗底文本对比度(色彩数学)/顶层 title·page-number 安全带钳位,**全部"只会变好"**(嵌套坐标/装饰/卡片文本/全出血 hero 标题一律不碰,交 Gemini)。slide-core 生成后先自修再校验。 | M2.5 |
| **P3** | **排版 + 配色(安全瘦版)** | ✅ **代码完成(2026-06-08,子代理 TDD+对抗审核,176 测试)** | 7 级字号阶梯 + 60/30/10 配色:**纯增益**——生成期引导(style YAML `typography_ladder`/`color_ratio`)+ **软警告专用**确定性校验器(`type-scale.js`/`color-ratio.js`,只读、永不改写 SVG、永不硬阻塞、exit 恒 0),补 Gemini 看不到的角度(数字号种数)。**零回退面**(结构性保证)。 | M2.6 |
| **P4** | **资源注入(Akxan 适配移植 + 轻量选择器)** | ✅ **代码完成(2026-06-08,适配移植+TDD+对抗审核,234 测试)** | 从 Akxan(MIT©sunbigfly)**适配移植**(非复制):failure-modes/design-cheatsheet/blocks/charts-catalog/color-psychology/layout-craft 六份——全部改写到本仓库**纯 SVG 模型 + outline schema**,不碰 layout 枚举;`reference-selector.js` 轻量按页型选增补 reference(替代重型 token assembler);index 注册 + ATTRIBUTIONS 署名。 | M2;Akxan(已核实) |
| **P5** | **PPTX 导出(方案D:SVG 原生嵌入 MVP)** | ✅ **MVP 代码完成(2026-06-08,验过 pptxgenjs SVG API + 结构化 TDD,workflow-san 24 测试全过);PowerPoint 保真待用户实测(D vs A 待定)** | workflow-san `svg-deck-to-pptx.js`:每页 SVG 经外链图内联(`inline-svg-images.js`)→ pptxgenjs `addImage` 原生 `asvg:svgBlip` + 真实 PNG 兜底(zip 后处理换掉 pptxgenjs Node 端坏 svg-png);`commands/ppt.md` Phase 7 additive 接线(失败不阻塞);`ppt/export` 门面文档(SVG→方案D / HTML→storybook)。**仅验 zip/XML 结构,PowerPoint 可编辑/保真=用户验**。 | bible-class Plan4 更佳;pptxgenjs SVG API 已核实 |
| **P6** | **跨页配图一致性 + 审查驱动重绘(post-M2.5 精简版)** | ✅ **代码完成(2026-06-08,TDD,203 测试全过(含 P6 新增 26:asset-consistency 7 + redo-plan 6 + prose 6 + validator 3 + manifest 4))** | 跨页同主体一致性(`asset.subject`/归一化 query 分组,master-first→`--reference` 派生)+ 审查驱动 `--redo` 重绘闭环(资产维度 <6 → scene 换新 seed 重绘封顶 2、brand-entity 回预览门重搜、触顶保留占位 `needs_real_image` 不假图)。两个纯逻辑只读规划库 `asset-consistency.js`/`redo-plan.js`(不调 generate.js、不抛错)。 | M2.5;image-gen `--reference`/`--redo`/`--seed` ✅ |
| P7 | core 抽离 + MCP | ⚪ 待办 | core/(Node/TS)+ MCP server,大重构 | 最后做 |

**当前推荐顺序**:M2 ✅ → M2.5 ✅ → M2.6 ✅ → P3 ✅ → P6 ✅ → P4 ✅ → P5 ✅(方案D MVP 代码完成;**用户单次 dogfood 验 PowerPoint 保真后定 D vs A**)→ **P7(留用户拍板)**。(B/F 收尾切片可选;可选 M2.7=review-core 效率调优,按需插入。)

### ✅ P5 — PPTX 导出(方案D:SVG 原生嵌入 MVP,代码完成 2026-06-08)
**spec/plan**:`specs/2026-06-08-fusion-p5-pptx-export-design.md` + `plans/2026-06-08-fusion-p5-pptx-export.md`。
**核心认知(本会话核实)**:pptxgenjs `addImage` 收到 SVG data URI 时**自动**产出 `asvg:svgBlip`(MS 2016 SVG 扩展)+ `image/svg+xml` 媒体 + svg ContentType——故方案D 无需手搓 OOXML。**但** Node 端 pptxgenjs 无法光栅化,自动 PNG 兜底被写成"SVG 字节冒充 png"(坏兜底)→ 导出器**后处理 zip**,把每页坏 `image-N-1.png` 换成真实/占位 PNG,保持 svgBlip 不变。
**已交付**:① workflow-san `scripts/svg-deck-to-pptx.js`(枚举 slide-NN.svg 数字排序、共享单 PptxGenJS 实例全幅 13.333×7.5in、容错单页不中断);② `scripts/inline-svg-images.js`(相对 `<image href>`→base64 data URI,缺文件不抛仅告警);③ `test/svg-deck-to-pptx.test.js`(unzip 断言 svgBlip/svg+png 媒体/svg ContentType/页数/内联 href,6 测试;全仓 24 测试全过);④ `commands/ppt.md` Phase 7 step 5 additive/尽力而为接线(导出器/Chrome 缺失→跳过+提示,不阻塞 SVG/HTML 交付)+ `ppt/export` 门面文档(SVG→方案D / HTML→storybook 交叉引用);⑤ dogfood 入口加 P5 验收清单。
**降级**:无 Chrome/无预渲染 PNG → 占位 PNG(老 viewer/缩略图空白,原生 SVG 仍可编辑),导出告警不中断。
**剩(用户)**:PowerPoint 2016+ 打开 `presentation.pptx` 验:每页显示?SVG 可点选编辑(非光栅化)?中文/字体?资产图在?保真够用→D 收官;不够→记差距评估方案A。**本会话只验 zip/XML 结构,不声称"已可用"**。

### ✅ P4 — 资源注入(Akxan 适配移植 + 轻量选择器,代码完成 2026-06-08)
**spec/plan**:`specs/2026-06-08-fusion-p4-resource-injection-design.md` + `plans/2026-06-08-fusion-p4-resource-injection.md`。
**核心修正(活路线图)**:① Akxan 是 HTML/CSS→截图管线,本仓库纯 SVG → **移植即适配**,不照搬代码;② 重型 token assembler 是过度工程(agent 现读整文件无 tokenizer 必要)→ 改**轻量选择器**(按页型返 reference ID 列表)。
**已交付**:① 六份适配移植 reference(`principles/failure-modes.md` 8 类失败模式+修复优先序、`design-cheatsheet.md` CRAP→本仓库 outline 字段、`blocks.md` 8 组件设计灵魂+SVG 落地提示、`charts-catalog.md` 分类法+新图型 SVG 骨架、`color-psychology.md` 60/30/10 呼应 P3、`layout-craft.md` 重力场画法且显式不改枚举);② `ATTRIBUTIONS.md`(Akxan MIT©2025 sunbigfly);③ index.json 注册六条(新域 principle/block/chart/craft,v1.2.0);④ `reference-selector.js`+CLI+测试(按 type/layout_type/data_elements 选增补 ref,上限 4,坏 index 优雅降级不抛错);⑤ slide-core/content-core/review-core 接线(核心必读固定,selector 加增补;review-core QA 固定读 failure-modes)。234 测试全过。
**对抗审核抓到并已修**:🔴 index `total_count.craft` 漏计(1→2)且测试固化错值 → 修计数+加防漂移测试;🔴/⚠️ selector 路由用了不存在的页型(section/timeline-as-type)→ 删伪分支 + 改用 `layout_type∈{single_focus,hero_grid,full_bleed}` 让正文页也能取 layout-craft;⚠️ blocks `url(#shadow)`→`#card-shadow`、裸 `clip-path` 补 `url(#avatar)`+clipPath;⚠️ charts gauge 静态示例数值对齐。
**剩(用户)**:dogfood 看数据页是否引入更专业 SVG 图型、失败模式指导是否降低"装饰多于信息"、页内上下文未爆炸。

### ✅ P6 — 跨页配图一致性 + 审查驱动重绘(精简版,代码完成 2026-06-08)
**spec/plan**:`specs/2026-06-08-fusion-p6-image-consistency-redo-design.md` + `plans/2026-06-08-fusion-p6-image-consistency-redo.md`。
**设计铁律**:① master = 组内**首生成**图(非人工认可;认可在 Phase 6 预览门,可替换并触发**重派生**整组);② seed 策略按目的相反——一致性派生用 master seed + `--reference`(求一样),审查 redo 用**新 seed**(求换更好,**绝不复用原 seed**);③ redo 封顶 2 轮、仅资产维度 <6 触发;brand-entity 低分走 reshoot(回预览门)非自动 redo(搜图≠生成);触顶保留占位 + `needs_real_image`,不假图。
**已交付**:① `asset-consistency.js`(`planReferences`:按 `subject ?? normalize(query)` 分组,master=最小页,scene/brand-entity 双 kind,singleton 走原路;只读、不调 generate.js、不抛错);② `redo-plan.js`(`planRedo`:scene<6 且未触顶→redo 透传 reference_of、brand<6→reshoot、触顶→exhausted、≥6 不动;只读、不抛错);③ outline `asset.subject` 可选字段 + validator 软警告(向后兼容 M2.5);④ images-manifest `reference_of`/`seed`/`redo_count` 字段透传 + 类型校验(缺省合法);⑤ research-core 接线(分组 master-first→`--reference` 派生,master 失败降级单图);⑥ reviewer 新增 `regenerate_image` 建议类型;⑦ review-core + ppt.md Phase 6 redo 闭环(`--redo` 新 seed、封顶 2、reshoot 回预览门、exhausted 保留占位、master 替换重派生)。203 测试全过(含 P6 新增 26:asset-consistency 7 + redo-plan 6 + prose 6 + validator 3 + manifest 4)(纯逻辑 + prose grep)。
**剩(用户)**:dogfood 验证同主体跨页视觉一致 + 坏生成图触发 redo 并复审通过 / 触顶保留占位。

### ✅ P3 — 排版阶梯 + 60/30/10 配色(安全瘦版,代码完成 2026-06-08)
**spec/plan**:`specs/2026-06-08-fusion-p3-typography-color-design.md` + `plans/2026-06-08-fusion-p3-typography-color.md`。
**设计铁律(继承 M2.6 哲学)**:P3 = 纯增益,**绝不自动改写 SVG、绝不硬阻塞、绝不触发 fix loop、exit 恒 0、永不抛错** → 结构性零回退面。价值在生成期引导 + 给 Gemini 的廉价确定性补充信号。
**已交付**:① 17 个 style YAML 增 `typography_ladder`(7 级 h1..micro)+ `color_ratio`(60/30/10 + buckets);② `type-scale.js`(数字号种数、too-many-sizes>6、off-ladder best-effort);③ `color-ratio.js`(SVG 几何面积估算、就近归桶、不足面积守卫、全出血背景守卫、软警告 info 级);④ `type-color-cli.js`(exit 恒 0)+ `style-mini-parser.js`(零依赖);⑤ `references/typography-ladder.md`;⑥ slide-core/review-core/reviewer 接线(advisory-only,hints 进 Gemini prompt)。176 测试全过。
**对抗审核抓到并已修**:🔴 渐变/全出血背景页(本仓库惯用版式)误报 `no-dominant` → 加全出血背景守卫;⚠️ 暗色主题跨桶颜色歧义 → 加 ±12 歧义守卫归 other;⚠️ 配色软警告降 info 级;⚠️ styles 测试补 bucket token 存在性校验;⚠️ advisory 步骤由"可选"改"标准"(保证 hints 可靠产出)。
**剩(用户)**:dogfood 时看 slide-status/审查产物是否出现 type-scale/color-ratio 软警告、且 fix-rounds 未因此上升。

### ✅ M2.6 — 确定性机械自修(代码完成 2026-06-08)
**spec/plan**:`specs/2026-06-08-fusion-m2.6-deterministic-autofix-design.md` + `plans/2026-06-08-fusion-m2.6-deterministic-autofix.md`。
**核心设计原则**:每个自修都"只会变好、绝不变坏"。**自审 + 集成烟测 + 对抗式终审接连抓到三类"修了反而更糟"并修掉**:① 暗底"最坏面"启发式会误改卡片/徽章上的深色文字(实测 slide-06 把 #22d3ee 徽章上的深色"2"改糊)→ 改为只修顶层文本 vs 页背景;② 全出血 hero 标题(M2.5 特性)压在照片/蒙版上会被误判 → 有全出血 `<image>` 时跳过对比度修复交 Gemini;③ 自带 transform / `<a>`/`<switch>`/嵌套 svg 内的文本被误当顶层 → 收紧顶层判定。
**已交付**:`color-contrast.js`(WCAG 亮度/对比度/调整)、`svg-autofix.js`(字号下限 + 顶层文本对比度 + 顶层 role 安全带钳位)、CLI、slide-core 打 `data-role` 并生成后先自修再校验、validator 安全区收紧到顶层(去嵌套误报)。125 测试全过,真实 SVG 烟测不破坏嵌套坐标。
**剩(用户)**:真实 dogfood 验证首轮通过率是否升、fix loop 是否降。

### ✅ M2.5 — 真实图片 + 视觉可用性门(代码完成 2026-06-08)
**spec/plan(单一来源)**:`specs/2026-06-08-fusion-m2.5-real-images-design.md` + `plans/2026-06-08-fusion-m2.5-real-images.md`。
**已交付(子代理 TDD,14 任务,97 测试全过)**:① outline `asset` 字段 + planning-validator 校验;② 共享 `render-svg.js`(SVG→PNG,Chrome headless,优雅降级);③ `images-manifest.js` + `asset-plan.js`(needs_real_image 交叉引用);④ 尽力而为 `image-search.sh`(probe+降级+curl 超时,非关键路径);⑤ outline-architect `asset` 规范;⑥ slide-core 放开 `<image>` + 图主导版式配方(full-bleed/scrim/split)+ 缺图 flag(禁假物);⑦ research-core 取图接线(brand→搜图 / scene→image-gen → images-manifest);⑧ ppt.md Phase 6 样片预览门(样片在前、批量在后);⑨ review-core 资产页渲染→Gemini `--image` 看图 + 资产维度 + reason(数据页维持文本审查);⑩ gemini-cli reviewer 加资产维度;⑪ 交付期 images 拷进 output。
**剩(用户)**:插件会话跑一次真实 dogfood(资产页主题,如 SU7),验证产物质量是否真的可用、reviewer 资产维度是否堵住虚假高分。
**动因(看渲染产物后,头号)**:真实 12 页 deck **无法使用**(第 3 页手绘通用轿跑与 SU7 无关、全 deck 零真实图、Gemini 8.2/全过 = 审查盲区虚假信心)。复核发现:数据/Bento 页其实专业,问题**集中在需要真实视觉资产的页**。
**已定方向(brainstorm 拍板)**:① 聚焦修复、**保留 Bento 引擎**;② 图源混合(品牌实体**联网搜图下载嵌入**、抽象/场景走 image-gen);③ 搜图在**资料调研阶段**;④ 图源可靠性靠**人工预览门兜底 + 自动搜图减负**(脆弱爬虫移出关键路径);⑤ 审查**双保险**(渲染→Gemini 看图的资产维度 + 早期人工预览门)。
**审核发现并已纳入 spec 的 4 处硬补丁**:① 主 reviewer 现只看 SVG 文本看不见照片 → 必须渲染 PNG 走 `--image`(管线已存在);② 嵌入≠好看 → 加配图处理约束;③ slide-core 需图主导版式配方(非只放权限);④ 需 SVG→PNG 渲染小工具(预览门+审查共用)。
**机械硬化已拆出为 M2.6**(见下),不在本里程碑。
**🔴 入口/详见**:spec 文档 + `docs/superpowers/2026-06-07-dogfood-findings-and-next-steps.md`。

### 🔴 M2.6 — 机械自修(确定性,紧随 M2.5)
slide-core 生成后**确定性钳位**(脚本,非 LLM 肉眼):安全区(标题基线≥~92、页码≤~688)、字号 <14 抬到 14、暗底对比度修正(禁 #6366f1 大字)。SVG 层补密度防线。review-core 效率(截断/重审、`node` 替 `npx tsx` 冷启动、瘦身 prompt)。**量化目标**:首轮通过率 58%→≥85%、修复轮次 0.8→≤0.3、wall-clock 大降。临执行再出 plan。

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
