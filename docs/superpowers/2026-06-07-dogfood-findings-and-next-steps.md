# 🔴 明天从这里开始 — Dogfood 实测发现 + 后续步骤(2026-06-07 晚)

> **🟢 2026-06-08 更新(M2.5 已实现)**:本文件的"头号发现"已转化为里程碑 **M2.5 = 真实图片 + 视觉可用性门**,并已 **brainstorm → 审核 → spec → plan → 子代理 TDD 实现完(97 测试全过)**。
> - 设计:`specs/2026-06-08-fusion-m2.5-real-images-design.md`;实现计划:`plans/2026-06-08-fusion-m2.5-real-images.md`;进度:`FUSION_ROADMAP.md`。
> - 关键改动:slide-core 放开 `<image>`(原 `slide-core.md:97` 禁令已解)+ 图主导版式;research 阶段联网搜图/image-gen → `images/` + manifest;Phase 6 **样片预览门**(样片在前批量在后);review-core **资产页渲染→Gemini `--image` 看图** + 资产/专业度维度(堵 8.2 虚假高分);缺图标 `needs_real_image` 不画假物。
> - **下一步**:① 用户跑一次真实 dogfood 验证产物质量;② **M2.6 = 确定性机械自修**(安全区/14px/对比度,首轮通过率 58%→≥85%)。
> - 下面是 2026-06-07 的原始发现记录(已被上面落实,保留供追溯)。

> **🟢 2026-06-08 第二次更新 — 下一步 = 跑 M2.5/M2.6 验证 dogfood(用户已选)。** 在插件会话里跑(需 Gemini OAuth);离线一致性已查:所有新脚本存在、`invoke-gemini-ppt.ts` 支持 `--image`+`--prompt`、125 测试全过。
>
> **跑什么**:挑一个**资产页密集**的主题(产品/品牌发布,如再来一版 `小米SU7发布会` 或换一个真实产品),触发 `asset.needed=true` 的封面/产品/设计页:
> ```
> /ppt-agent:ppt --pages=12 <资产页主题>
> ```
> **验收清单(逐条看,对应 M2.5/M2.6 的修复点)**:
> 1. **真图出现**:打开某资产页的渲染 PNG / `output/index.html`,确认封面/产品页**真的嵌了真实照片**(有 `<image>`),不是手绘假物;`images-manifest.json` 有 `fetched`/`generated` 记录。(M2.5 核心)
> 2. **缺图不造假**:搜不到图的资产页应是 `needs_real_image` 占位 + 在 Phase 6 样片预览门列出,而不是手绘假车。(M2.5)
> 3. **样片预览门**:Phase 6 应先只出"封面+1资产页"样片让你过眼,确认后才批量——不再一口气跑完 12 页。(M2.5)
> 4. **视觉审查真生效**:看 `reviews/gemini-raw-*.md`,资产页应有 **Asset Relevance & Professionalism 数值评分**(说明渲染→`--image` 看图跑通了),不是只评排版。(M2.5,堵 8.2 虚假高分)
> 5. **机械自修生效**:slide-core 出图后应跑过 `svg-autofix`;字号无 <14、暗底文本对比度达标;**且没有把卡片/徽章上的深色文字或 hero 照片上的标题改糊**(M2.6 的"只会变好"——若发现某处被改坏,记下来,是回归)。
> 6. **首轮通过率 / fix 轮次**:对比基线(首轮 58%、修复 0.8/页),看是否上升/下降;回贴 `review-manifest.json` + `slide-status.json` 精确化。
>
> **跑完回贴**:产物 `output/index.html` 观感 + 上面 6 条结论 + `review-manifest.json`/`slide-status.json`。据此再决定下一里程碑(P3 安全瘦版 / P4 资源注入 / 其它)。**别在验证前继续堆 P3+**(本文件下方"头号发现"正是这个教训)。

> **给明天 clear 后的自己/接手者**:这是单一入口。读完这份就知道今晚做了什么、发现了什么、下一步干什么。
> 相关文档:活路线图 `FUSION_ROADMAP.md`、基线结果 `plans/2026-06-07-fusion-m2-baseline-results.md`、M2 spec/plan(`specs/`、`plans/`)。
> 记忆指针:`fusion-mainline-progress`、`living-roadmap-jit-plans`。

---

## 一句话现状(2026-06-07 晚,看了渲染产物后修订)
**M2 代码完成(58 测试),真实 12 页 dogfood 跑通,但用户看了渲染的 `output/index.html` 后判定产物质量"相当差、无法使用"——Gemini 给了 8.2/12 全过却是虚假信心。真问题比 M2.5 机械修复更根本:生成的视觉/内容质量不行 + 审查有盲区。下一步应先 brainstorm 生成与视觉质量策略(结合原帖 + 目录两个项目优点),M2.5 机械硬化是其中一块。**

---

## 🔴🔴🔴 头号发现(看渲染产物后,2026-06-07 晚补):产出质量根本不行,审查给了虚假信心
用户打开 `openspec/changes/ppt-xiaomi-su7-launch/output/index.html` 实际查看后:**质量相当差、无法使用**。具体:
- **第 3 页车型与小米 SU7 毫无关系**。根因(已查 `slides/slide-03.svg`):slide-core 用 `<path>` **手绘了一个通用轿跑剪影**("aerodynamic coupe silhouette, drawn around origin",4 条 path),永远不可能像真实 SU7。
- **整套 deck 零 `<image>` 标签** —— 管线只产 文字 + Bento 卡片 + 粗糙矢量涂鸦,**没有任何真实产品图**。对"产品发布会"这种主题是致命缺陷。
- **Gemini 给 8.3 / 全过,但产物不可用** —— reviewer 只评 layout/配色/字号/密度,**不评"illustration 像不像、内容对不对、专不专业"**。→ **dual-model 审查有盲区,8.2 分是虚假信心**。
- **巨量 token + 1h53m 换来一个无法使用的 PPT** —— 价值比当前严重存疑。

**这比 M2.5(安全区/字号等机械违规)更根本。机械硬化不会让"丑/错的插画"变好。** 真正要解决的三层:
1. **视觉资产策略**:要么给产品/封面页接入**真实图片(image-gen,P6)**,要么**禁止 slide-core 画假的产品插画**(改用抽象/图标化处理)。产品发布会尤其需要真实产品图。
2. **审查盲区**:Gemini 审查需要一个"**资产质量 / 内容贴切度 / 专业度**"维度,或更早的人工预览门——否则继续给虚假高分。
3. **生成方式本身可能是弱点**:Claude 手绘 Bento SVG + 粗糙矢量插画 ≠ 专业 deck。**这正是原帖的不同点**:原帖让 **Gemini 直接出整页 SVG**(Gemini 3 视觉更强),且明确"不要可编辑性时推荐生成 HTML"(更丰富);workflow-san 走 **HTML→PPTX 真保真**。

**🔴 用户给的战略方向**:"根据原帖(linux.do/1782304)并结合目录中两个项目(ppt-agent + ppt-agent-workflow-san)的优点进行优化。" → 这是一个**战略 brainstorm 题**,不是直接写代码。

---

## (次级)效率/机械瓶颈 — 原"一句话现状"
**M2 跑通、太慢太贵(1h53m),slide-core 生成确定性硬违规(安全区/字号/密度/对比度)触发昂贵 fix loop。M2.5 机械硬化仍值得做,但它是次级问题,折叠进上面的质量战略里。**

---

## 今晚做完的事(都已提交 main)
1. **P0 基线 + 源核实**、**Gemini `--skip-trust` bug 修复**、**M1 `--stop-at`**(28 测试)——更早完成。
2. **M2 质量门控**(本晚重点,子代理 TDD,**58 测试全过**):
   - `skills/_shared/references/density-targets.json`(密度预算单一来源)
   - `skills/_shared/scripts/lib/planning-validator.js` + `planning-validator-cli.js`(Phase 4 门控:硬错阻塞/软警提示/3 轮封顶/无 Node 降级)
   - review-core 传页型(含封面/尾页查找)、outline-architect schema 对齐 + 方法论嵌入
   - **dogfood 期间修了一个 validator 误伤**(quote/image 页 1–2 行点睛被误判 critical;已改成 `units>3` 才 critical,commit `94d978f`)
3. **真实 12 页 dogfood 跑**(用户在插件会话跑 `--pages=12 --stop-at=design 小米SU7`)。

---

## 🔴 Dogfood 三大验证(全过)
- **M1 `--stop-at=design`**:Phase 6 完成即停、写了 early-delivery README、未跑交付。✅ 生产验证
- **Gemini 审查**:逐页 + 2 次 holistic 全出真分(`--skip-trust` 生效,无静默降级)。✅
- **M2 planning_validator**:Phase 4 实跑(但价值受限,见瓶颈)。✅ 接线通

---

## 🔴 实测基线(从运行 transcript 提取;精确 fix_rounds 待 `slide-status.json` 确认)
- **终分平均 = 8.2/10**(12/12 全过)——印证此前复审 7.49 是"未传 style+页型"的测量口径偏低,生产真值是 8.2。
- **首轮通过率 ≈ 58%(7/12)**:首审即过 = 01·05·08·09·10·11·12。
- **需 fix loop = 5/12(42%)**:02·03·04·06·07 首审失败。
- **平均修复轮次 ≈ 0.8/页**。
- 逐页终分:01=8.75 · 02≈7.2 · 03=8.3 · 04≈7.2 · 05=8.1 · 06≈7.2 · 07=9.5 · 08=7.8 · 09=8.4 · 10=8.1 · 11=8.5 · 12=9.3;holistic 7.5→(1 条 P1 配色协调修复)→7.8。
- **结论**:v3 的"首轮通过率 ≥60%"基本已达到 → **M2 的价值不在提首轮通过率,真问题在别处(见下)。**
- ⏳ 待办:把 `openspec/changes/ppt-xiaomi-su7-launch/slide-status.json` / `review-manifest.json` 贴回,精确化每页 fix_rounds,回填本文件与基线文档。

---

## 🔴🔴 最大发现:瓶颈在 slide-core 生成阶段(决定下一步)
**5 个失败页的原因高度集中在 slide-core 出图时"可预测的确定性硬规则违规"**,这些本可在生成阶段自我避免,却一路漏到 Gemini → 触发昂贵的 fix loop + 重审:

| 违规类型 | 命中页 | 性质 |
|---|---|---|
| **安全区:标题基线 y=62–80 顶破 60px** | 01·02·04·06·07(几乎全中) | **系统性**——编排器自己都说"slide-core 把标题基线放 y=62-80…后续我让≥92" |
| **字号 <14px(13px 标签)** | 03·05·07·09 | 系统性——slide-core 无视 14px floor |
| **密度超标(SVG 阶段加的卡片/图表)** | 03·04·06·07 | planning_validator(大纲阶段)**抓不到**——是 slide-core 出图时加超的 |
| **对比度 #6366f1 在暗底 2.7:1** | 06 | token 用错 |

**外加效率黑洞**:review-core agent **多次被截断**(Gemini 单次跑 4–5 分钟,子代理超时没写完 → 重派),加上每页 review 28–50k tokens、`npx tsx` 每次冷启动、lead 上下文堆 12 页 SVG。这是 **1h53m + 巨量 token** 的主因。

**核心洞察**:slide-core 其实已有"生成后自动校验"步骤,但它**只报不修** → 硬违规漏到 Gemini,触发本可避免的 fix loop。**把这一步从"只报"改成"确定性自修",能同时砍掉成本和 fix 轮次。**

---

## 🔴 下一个里程碑(优先于 P3):slide-core 硬化 + 生成即自修(质量+效率)
**为什么是它而不是 P3**:它同时攻击 1h53m 成本 *和* fix 轮次,杠杆最高;且 P3 的"14px 字号 floor"问题正好被它覆盖。

**建议范围(明天 brainstorm 时细化):**
1. **slide-core 生成后确定性自修**(而非只报):
   - 标题/页码基线**钳进 60px 安全区**(标题基线≥~92、页码≤~688);
   - 字号 **<14 自动抬到 14**(含图表标注);
   - token 对比度修正(暗底禁用 #6366f1 当大字,换 #818cf8 等达 ≥3:1)。
   - → 送 Gemini 前清掉所有确定性硬违规,Gemini 只评"美学",fix loop 大降。
2. **密度防线补到 SVG/draft 阶段**:planning_validator 只管大纲;slide-core 出图时也要守 info-units 预算(或出图后对 SVG 估密度)。这是 M2 在大纲阶段抓不到 SVG 密度的缺口。
3. **效率**:查 review-core 截断/重审(Gemini 超时处理、`node` 直跑替 `npx tsx` 冷启动、瘦身 review prompt:别每页重塞整份 reviewer.md + 全量 SVG)。
4. (可选)lead 上下文瘦身——根治在 P7 core 抽离,这里先缓解。

**可量化目标(用今晚基线)**:首轮通过率 58%→≥85%(把 5 个确定性失败页里的 safe-area/font/contrast 类在生成阶段消灭);平均修复轮次 0.8→≤0.3;wall-clock 大幅下降。

---

## 🔴 明天的确切步骤(START HERE)— 已按"看渲染产物后"重排
**先解决"产物不可用"这个根本问题,再谈 M2.5 机械硬化。**

1. **(可选)先亲眼看产物**:打开 `openspec/changes/ppt-xiaomi-su7-launch/output/index.html`,确认质量差在哪(尤其第 3 页假车、有没有任何真实图)。
2. **🔴 头等事:战略 brainstorm —"生成与视觉质量"**(用 `superpowers:brainstorming`)。题目:如何让产物真正可用?围绕用户方向"原帖 + 两项目优点"探讨这些取舍:
   - **真实图片** vs **禁止假插画**:产品/封面页接 image-gen(P6)出真实图?还是 slide-core 改走抽象/图标化、不画假车?
   - **谁来出 SVG**:维持 Claude 手绘 Bento SVG,还是像原帖让 **Gemini 出整页 SVG**?
   - **要不要 HTML 产物线**(原帖"非编辑用 HTML 更丰富" + workflow-san HTML→PPTX 真保真)?
   - **审查补维度**:给 reviewer 加"资产质量/内容贴切/专业度",或加更早的人工预览门,堵住 8.2 虚假高分。
   - 调研输入:**重读原帖 linux.do/1782304**(见 `FUSION_PLAN_REVIEW.md §二` 已抓的正文)、对照 `ppt-agent` 与 `ppt-agent-workflow-san`(后者 `method.md` 6 层模型 + `html-slide-to-pptx`)。
   产出:一份 spec(`docs/superpowers/specs/`),定清下一步到底改什么。
3. **M2.5 机械硬化**(安全区/14px/对比度自修)——确认仍要做的话,折叠进上面的 spec 或作为紧随其后的小里程碑。实施前读 `agents/slide-core.md` 现有"生成后自动校验"步骤,搞清为何只报不修。
4. **贴回** `slide-status.json` → 精确化 fix_rounds(锦上添花,不阻塞 brainstorm)。
5. 全程老节奏:brainstorm → spec → writing-plans → 子代理 TDD → 更新 `FUSION_ROADMAP`。

> 备注:这条线一律遵循 [[living-roadmap-jit-plans]]:全貌看 `FUSION_ROADMAP.md`,落地一个里程碑一份即时 plan。直提 main、不开分支。Gemini 走 OAuth 订阅(无需 key)。

---

## 其它待办/未决
- **布局/页型枚举大清理**(timeline 是 layout 非 type;layout 命名三处不一致)——已记在 roadmap 收尾切片。
- **B/F 切片**(语义策划稿门控 / narrative-rhythm / pipeline-compat)——M2 推迟项,P3 之前可选。
- **P3 排版+配色**——部分被"slide-core 硬化"覆盖(14px floor),剩 7 级字号阶梯 + 60/30/10 配色比例,排在硬化之后。
- 这套流程**产出质量是好的**(8.2 均分、智驾高潮页 9.5),问题是贵和慢——下一步对症。
