# 🔴 明天从这里开始 — Dogfood 实测发现 + 后续步骤(2026-06-07 晚)

> **给明天 clear 后的自己/接手者**:这是单一入口。读完这份就知道今晚做了什么、发现了什么、下一步干什么。
> 相关文档:活路线图 `FUSION_ROADMAP.md`、基线结果 `plans/2026-06-07-fusion-m2-baseline-results.md`、M2 spec/plan(`specs/`、`plans/`)。
> 记忆指针:`fusion-mainline-progress`、`living-roadmap-jit-plans`。

---

## 一句话现状
**M2(质量门控)代码已完成(58 测试全过),并用一次真实 12 页 `/ppt` 跑做了端到端 dogfood。跑通了、产出质量好(8.2/10),但太慢太贵(1h53m),且实测暴露了真正的瓶颈在 slide-core 生成阶段。下一步不是 P3,而是"slide-core 硬化 + 生成即自修"。**

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

## 🔴 明天的确切步骤(START HERE)
1. **贴回** `openspec/changes/ppt-xiaomi-su7-launch/slide-status.json`(或 review-manifest.json)→ 让我精确化 fix_rounds,回填本文件 + 基线文档。
2. **确认下一里程碑** = "slide-core 硬化 + 自修"(本文件上面那节)。如认可:
3. 走老节奏:**brainstorm(范围对齐)→ spec → writing-plans → 子代理 TDD 执行 → 更新 FUSION_ROADMAP**。
4. 实施前先**读 `agents/slide-core.md` 现有的"生成后自动校验"步骤**——搞清它现在到底校验什么、为什么只报不修,自修就加在那里。

> 备注:这条线一律遵循 [[living-roadmap-jit-plans]]:全貌看 `FUSION_ROADMAP.md`,落地一个里程碑一份即时 plan。直提 main、不开分支。Gemini 走 OAuth 订阅(无需 key)。

---

## 其它待办/未决
- **布局/页型枚举大清理**(timeline 是 layout 非 type;layout 命名三处不一致)——已记在 roadmap 收尾切片。
- **B/F 切片**(语义策划稿门控 / narrative-rhythm / pipeline-compat)——M2 推迟项,P3 之前可选。
- **P3 排版+配色**——部分被"slide-core 硬化"覆盖(14px floor),剩 7 级字号阶梯 + 60/30/10 配色比例,排在硬化之后。
- 这套流程**产出质量是好的**(8.2 均分、智驾高潮页 9.5),问题是贵和慢——下一步对症。
