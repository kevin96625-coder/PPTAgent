# P0 调研:质量基线实测 + Akxan 源核实 + 现状对齐

> 类型:轻量调研笔记(非 TDD 计划)。对应 `FUSION_PLAN_REVIEW.md §八` 的 P0。
> 目的:清掉两个会左右后续计划怎么写的"未知数",再动笔写 M1+ 的可执行计划。
> 日期:2026-06-07 · 调研人:Claude(Opus 4.8)
> 一手依据:`docs/images/*.svg`(14 张已提交 deck)实测;GitHub 直查 `Akxan/ppt-agent-skill`;`ppt-agent` 代码库实查。

---

## 结论先行(TL;DR)

| 未知数 | 结论 | 对计划的影响 |
|--------|------|--------------|
| **质量基线** | **2/5 指标现在能实测,2/5 必须重跑带埋点的生成,1/5 缺定义** | M2 目标不能照搬 v3;需先补一次 instrumented run 才能定 pass-rate/fix-rounds 基线 |
| **Akxan 源** | **存在、公开、MIT、确含所需资源库** | F3 从"未核实风险"降级为"可移植依赖";M3/P4 可放心依赖,但要署名 |
| **现状对齐** | 审核 §二 的盘点全部复核属实 | 维持审核结论,补一条 svg2pptx 重磅发现 |

**附带重磅发现**:Akxan 仓库内含 `scripts/svg2pptx.py`——一个现成的 **SVG→PPTX 转换器(MIT)**。这直接改变审核 §五 对"方案 A(结构化 SVG→PPTX 解析)= 大工作量"的判断:**可能有现成代码可移植**。详见下文 §3。

---

## 1. 质量基线实测

### 1.1 测量对象
`ppt-agent/docs/images/slide-01..14.svg` —— 14 张已提交的小米 SU7 deck(README 记为"当前运行效果,14 页,8.5/10,深蓝商务橙")。这是仓库里唯一可直接量的成品 deck。同级 `gpt54/`(SVG)、`minimax/`(SVG)、`mimo/`/`claude/`(PNG)为其它模型变体。

### 1.2 五指标实测结果

| 指标(v3 定义) | 现在能否实测 | 实测值 | 说明 |
|----------------|--------------|--------|------|
| **排版违规率**(字号 <14px 页数/总页) | ✅ 能(SVG 字号是写死 px) | **0% (0/14)** | **14 张 deck 的最小字号一律正好 14px——系统已强制 14px 下限。M2 的排版目标(0%、≥14px)其实已达成。** |
| **信息密度超标率**(>7 信息单元页数/总页) | ⚠️ 缺定义 | 无定论 | 按原始 `<text>` 计数 = 86%(12/14);但一张统计卡含 3 个 text 只算 ~1 信息单元,按"卡片数"计大多 3–5 张(达标)。**"信息单元"无可操作定义前,这个数不可信。** |
| **Gemini 审查平均分** | ✅ **能**(gemini CLI 已用 OAuth 订阅登录,无需 API key——实测 `gemini -p ... --skip-trust` 返回正常) | README 记录 8.34–8.53;现可重测 | 现成 SVG 可用 review-core 单跑重测,不必重生成。**更正**:此前误判"需 GEMINI_API_KEY",实为 gemini CLI 走订阅鉴权,见 §6 |
| **一次通过率**(一次通过/总页) | ❌ 不能 | — | **仓库未提交任何 review-manifest / review 日志**,无法从产物回填 |
| **平均修复轮次**(总修复轮次/总页) | ❌ 不能 | — | 同上,需重跑带埋点的生成 |

### 1.3 三条关键发现(直接改写 M2)
1. **排版已达标**:14px 下限已在执行,排版违规率 = 0%。M2 不该再把"排版违规率→0%"列为提升项,应改为"**回归守护**:确保新增资源注入/PPTX 导出不破坏现有 14px 下限"。
2. **密度指标先要定义再要基线**:必须先把"信息单元"操作化(建议 = 卡片/区块数,而非 text 节点数),否则 v3 的"≤10% 超标"无法验收。建议在 P3(字号/配色)里一并落地"信息单元"判定规则。
3. **pass-rate / fix-rounds 无法回填**:这两项只能靠**一次带埋点的 `/ppt` 运行**取得(把每页 review 轮次写进 `review-manifest.json` 并落盘)。这是真正需要补的 P0 动作,且只有 Claude Code 宿主能驱动整套编排(`commands/ppt.md` 是散文编排,不能当脚本跑)。

> **可执行建议**:在 M2 计划启动前,跑一次标准 12 页小米 SU7,并**保留** `runs/<id>/review-manifest.json`(当前默认不提交),由它一次性补齐 pass-rate + fix-rounds + 逐页 Gemini 分三项真实基线。成本:一次生成。**鉴权已就绪**:gemini CLI 已 OAuth 订阅登录(`~/.gemini/settings.json` = `oauth-personal`),无需 API key——但要先修 §6 的 trusted-folder bug,否则 review 会静默降级。

---

## 2. Akxan/ppt-agent-skill 源核实(F3 收口)

GitHub 直查确认仓库**真实存在**(WebSearch 摘要曾漏报,GitHub 仓库搜索 `ppt-agent-skill` 列表中明确含 `Akxan/ppt-agent-skill`):

| 核实项 | 结果 |
|--------|------|
| 可访问性 | ✅ 公开 |
| 许可证 | ✅ **MIT**(允许移植,需保留版权署名) |
| README 定位 | "一句话生成设计公司级 deck(HTML + 可编辑 PPTX),26 styles · 18 charts,对标 Linear/Anthropic/Stripe/Apple/NYT" |
| `references/charts/` | ✅ basic / advanced / complex 三档 |
| `references/styles/` | ✅ 26 种风格 |
| `references/typography.md` | ✅ 14 条排版规则 |
| `references/bento-grid.md` | ✅ 7 种布局规格 |
| `references/principles/failure-modes.md` | ✅ 8 类失败模式 |
| `scripts/` | `html2svg.py`、**`svg2pptx.py`**、`gallery.py`、`smoke_test.py` |

**F3 修正**:Akxan 从"未核实外部依赖"→"**已核实、公开、MIT 的可移植资源库**"。M3/P4 可放心依赖。

**但有两点要校准 FUSION 的措辞**:
- FUSION 说"移植 `prompt_assembler.py / resource_assembler.py / planning_validator.py`",而 Akxan 实际提供的是 **`references/` 下的 markdown 资源内容**(charts/styles/typography/bento/principles),**没有**这些 `*_assembler.py`。→ 即:**资源内容**可移植自 Akxan,**按需注入的 assembler** 仍是我们自建(且按审核 F5 用 Node/TS 写)。P4 计划要据此重写。
- 来源仍要正名:Akxan 库**存在 ≠ 原帖正文提过它**。审核 §六的"来源错挂"修正照旧——这些资源标 Akxan,**不标"原帖"**。

---

## 3. 附带发现:Akxan 自带 svg2pptx.py(改写审核 §五)

审核 §五把"方案 A:结构化 SVG→PPTX 解析(`<text>`→文本框、`<rect>`→形状)"评为"大工作量",并推荐先做"方案 D:SVG 原生嵌入"作 MVP。

新事实:**Akxan(MIT)自带 `scripts/svg2pptx.py`**,且其产物 README 自称"可编辑 PPTX"。这意味着:
- 方案 A 不必从零写——可**先评估/移植 Akxan 的 svg2pptx.py**,工作量可能从"大"降到"中"。
- ppt-agent 出的正是 SVG(viewBox 0 0 1280 720),与 Akxan 的 SVG→PPTX 管线**天然对口**(不像 workflow-san 是 HTML→PPTX、且只有 2 个写死 preset)。
- → **P5(PPTX)计划应新增一步:先实测 Akxan svg2pptx.py 吃 ppt-agent 的 Bento Grid SVG 的保真度**,再决定方案 D(原生嵌入,最低成本)与方案 A(移植 Akxan 解析器,逐元素可编辑)谁做 MVP。这把审核 §五 的"D 优先"从结论变成了"D vs 移植A,用实测定"。

---

## 4. 现状对齐复核(审核 §二 抽查)

| 断言 | 复核 |
|------|------|
| 无 `--stop-at` | ✅ 确认缺失(commands/agents/skills 全库无匹配)→ M1 确需新增 |
| `--run-id` / `RUN_DIR` 恢复已存在 | ✅ `commands/ppt.md` 出现 75 次 → M1 只需加"提前停止"语义,对接已有恢复 |
| 无 charts/blocks/principles 资源库 | ✅ 确认缺失 → 正是 M3 要从 Akxan 移植的 |
| 无 pptx-export / prompt_assembler / planning_validator | ✅ 确认缺失(仅 bible-class 计划文档里提到 pptx) |
| `skills/_shared/index.json` 资源注册表已存在 | ✅ 存在(v1.1.0,已注册 prompts 等),只是尚无 charts/blocks/principles 域 → M3 是"往现成注册表里加域",非从零建注册表 |
| image-gen(Plan1)/ bible-class(Plan2)已落地 | ✅ `skills/image-gen`、`skills/bible-class` 均在 |

审核 §二 盘点**全部属实**,无需更正。

---

## 5. 这对"怎么写后续计划"的净影响(交接给 B)

1. **M1 `--stop-at`(P1)不依赖以上任何未知数**——最独立,可立即用 writing-plans 开写。恢复逻辑已存在,工作量小。
2. **M2 质量门控的目标值要重设**:排版违规率已是 0%(改为回归守护);pass-rate/fix-rounds 基线**待一次带埋点运行补齐**(需 GEMINI_API_KEY);密度指标**先定义"信息单元"再设目标**。
3. **M3 资源注入(P4)依赖已解除**:Akxan 公开+MIT,移植路径清晰;但 assembler 自建(Node/TS),资源内容来自 Akxan `references/`。
4. **M4 PPTX(P5)新增前置实测**:Akxan svg2pptx.py 保真度实测 → 定方案 D vs 移植A。
5. **Gemini 鉴权已就绪(更正)**——不需要 GEMINI_API_KEY,gemini CLI 已走 OAuth 订阅。但 §6 的 trusted-folder bug 会让 review 静默降级为纯技术校验(无美学分),**必须先修**,否则 pass-rate/逐页分 基线和任何 A/B 都拿不到真分。

---

## 6. 更正与新发现:Gemini 评分走订阅,且有一个静默降级 bug

**问题原文**:用户问"Gemini 平均分是否用 LLM 模型评价?能否用本地 gemini CLI / antigravity CLI 的订阅?"

**核实结果**:
1. **是 LLM 评分**:`review-core` 调用 `skills/gemini-cli/scripts/invoke-gemini-ppt.ts`,该脚本 `spawnSync("gemini", ...)` 调**本地 gemini CLI(headless)**,让 Gemini 模型当美学审查官,评 layout/color/typography/readability/density 并输出 `overall_score` 1–10。skill 明确说明 Claude 自评无效(12 页全打 8.2–8.8 雷同),**跨模型(Claude 出图 / Gemini 打分)正是设计核心**。
2. **本来就用订阅,不用 API key**:脚本不读 `GEMINI_API_KEY`,鉴权完全交给 gemini CLI。本机 `~/.gemini/settings.json` = `oauth-personal`,`oauth_creds.json` 存在 → 已用 Google 账号订阅登录。实测 `gemini -p "..." --skip-trust` 返回正常。→ **此前 P0 草稿"需 API key"的说法作废。**
3. **antigravity CLI**:本机也装了(`~/.gemini/antigravity-cli/`),同样走 Google 订阅。但脚本**写死调 `gemini` 二进制**,用 antigravity 需改脚本换命令。无必要——gemini CLI 路径已通且正是 review-core 设计的那条;除非想用 antigravity 更高额度/Gemini 3 Pro,才值得加一个 backend。

**🐛 新发现的 bug —— 已修复并验证(2026-06-07)**:gemini CLI 0.42 新增 "trusted-folder" 守卫——在非信任目录里 headless 调用会直接失败:
> `Gemini CLI is not running in a trusted directory. To proceed, either use --skip-trust, set GEMINI_CLI_TRUST_WORKSPACE=true ...`

而 `invoke-gemini-ppt.ts` 原第 76 行 spawn 的 args 是 `["-p", finalPrompt, "--approval-mode", "plan", "-o", "text"]`——**没带 `--skip-trust`**。后果:在任意未信任目录跑 `/ppt`,Gemini 调用静默失败 → 脚本 `exit 2` → review-core **降级为纯技术校验,不出美学分**。本机仓库恰好被 `trustedFolders.json` 信任才没犯,换台机器(新装插件)必中。

**严格验真(三步,均实测)**:
- REPRO 1(本仓库,已信任):真实脚本 exit 0 ✅ —— 说明 bug 环境依赖,不能只看一次。
- REPRO 2(全新未信任 `/tmp`):真实脚本三模型全 `status=55` → `All Gemini models failed` → `exit 2`,且未污染 `trustedFolders.json`。**bug 坐实。**
- 验证修复(未信任 `/tmp`):加 `--skip-trust` 后,手测 + 真实脚本均 `exit 0` 并正常写出 output。

**已实施修复**:`tryGemini` 的 args 加入 `"--skip-trust"`(`skills/gemini-cli/scripts/invoke-gemini-ppt.ts`,带注释说明这是 headless 专用逃生口)。修后在未信任 `/tmp` 用真实脚本复测通过。

---

> **下一步(B)**:用 `writing-plans` 技能写 **P1 `--stop-at`** 的可执行计划(它最独立、不等任何未知数)。M2 计划暂缓到"带埋点基线运行"就绪(鉴权已不是阻塞项,只剩修 §6 bug + 跑一次留存 review-manifest)。
