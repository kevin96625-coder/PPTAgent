# P4 — 资源注入(Akxan 适配移植 + 轻量选择器)设计

> 状态:设计 → 自审 → 执行(2026-06-08)。上游:`FUSION_ROADMAP.md` §P4。依赖:M2(index.json 注册表已在)、Akxan(已 clone 到 `/tmp/akxan-probe`,MIT © 2025 sunbigfly)。
> **活路线图修正**:原计划"Akxan 资源库 + Node assembler 按需注入(≤3000 tokens)"。核实后两点收敛:① Akxan 是 **HTML/CSS→截图** 管线,本仓库是**纯 SVG(1280×720 viewBox,`${token}` hex)**——**不能照搬代码模板**,只移植**模型无关的指导**并按本仓库 SVG 习语适配;② 重型 token 预算 assembler 是**过度工程**(agent 现读整文件 ~7k tokens,无 tokenizer 必要)——改为**轻量选择器**(按页型返回相关 reference ID 列表,agent 读选中的小文件)。

## 0. 为什么是"适配移植"而非"复制"(自审前置)

Explore 实测 Akxan `references/` 高质量、可移植,但有**三处模型/schema 不匹配**,照搬必误导本仓库 agent:

1. **SVG vs HTML/CSS**:Akxan charts 是 `<div style="...">` + CSS 变量 + `backdrop-filter`/`mask-image`;本仓库 slide-core 产 `<g transform><text><rect fill="${accent}">`。**charts 代码模板、css-weapons 的 CSS-only 技法不能直接给 slide-core**——会让它产出本管线无法渲染的 HTML。→ 只移植 charts 的**分类法/选型决策/设计灵魂**,并把高价值新图型(radar/funnel/gauge)**用本仓库 SVG 习语重写**;css-weapons 只取 **SVG 可用子集**(渐变/clip-path/mask 在 SVG 内的写法),明确标注。
2. **Schema 不匹配**:Akxan `design-principles-cheatsheet.md` 把原则映射到 **Akxan 的 `planning.json`/`cards[]` 字段**;本仓库 outline 是 `outline.json`(parts/pages/asset/layout_type/data_elements)。→ 移植 cheatsheet 时**把字段映射改写到本仓库 outline schema**,否则 content-core 会按不存在的字段决策。
3. **Layout 枚举冲突**:本仓库已有 `bento-grid-layout.md`(10 个 `layout_type` 枚举,validator 硬校验)。Akxan layouts 是"重力场"哲学 + 5 个新型(hero-top/l-shape/t-shape/waterfall/primary-secondary)。→ **不新建平行 layout 分类法**;把 Akxan 的重力场**哲学/变体手法**作为**现有 layout_type 的设计深化注解**并入(或独立 `layout-craft.md` 但明确"丰富现有枚举的画法,不改枚举"),避免与 validator 的 10 枚举打架。

**铁律**:移植即适配——每份移植文件必须 ① 匹配本仓库 SVG 输出模型;② 匹配本仓库 outline schema;③ 不与现有 reference(bento-grid-layout/cognitive-design-principles/typography-ladder/svg-generator chart 段)重复或冲突,只补**净新**;④ 带 Akxan 署名。

## 0.1 语言

Akxan 内容为中文;本仓库 prompts 多为英文,但 **CLAUDE.md 要求 Chinese 输出、用户为中文使用者**。→ 移植内容**保留/采用中文**(高质量且贴合用户),无需翻译成英文;与现有英文 reference 并存(agent 双语皆可读)。在文件头注明。

## 1. 交付物

| # | 交付 | 类型 | 净新价值 |
|---|------|------|----------|
| A | `references/principles/failure-modes.md`(适配) — 8 类失败模式 + 修复优先序;字段/术语映射到本仓库 outline + SVG | 文档 | 本仓库**完全缺失**;给 review-core/QA 用 |
| B | `references/design-cheatsheet.md`(适配) — 设计原则→**本仓库 outline.json 字段**决策映射(CRAP/对比/密度/scene 力度表) | 文档 | 缺失;给 content-core/slide-core 用 |
| C | `references/blocks.md`(整合) — 组件设计灵魂(card-styles 6 变体 / timeline / diagram / quote / comparison / people / image-hero / matrix)——**哲学+何时用+SVG 落地提示**(非 HTML 代码) | 文档 | 缺失的"blocks 抽象" |
| D | `references/charts-catalog.md`(适配) — Akxan 18 图分类法 + 选型决策矩阵 + 设计灵魂;**新图型 radar/funnel/gauge/waffle 用本仓库 SVG 习语示例**;与 svg-generator 既有 chart 段交叉引用不重复 | 文档 | 深化现有薄 chart 段 |
| E | `references/color-psychology.md`(适配) — 60/30/10 + 色彩情绪 + 对比安全;**与 P3 `color_ratio` 呼应** | 文档 | 缺失;补 P3 配色理论侧 |
| F | `references/layout-craft.md`(适配) — 重力场哲学 + 5 变体手法,**作为现有 10 个 `layout_type` 的画法深化**,显式声明"不改枚举、validator 不动" | 文档 | 深化现有 layout |
| G | `ATTRIBUTIONS.md`(仓库根或 _shared) — Akxan MIT © 2025 sunbigfly 署名 + 移植清单 | 文档 | 合规 |
| H | index.json 注册 A–F 为新域 `principle`/`block`/`chart`/`layout-craft`(沿用现有 schema:id/domain/name/file_path/keywords/description/use_cases),带**页型/数据特征关键词**便于选择 | 数据 | 可发现 |
| I | `lib/reference-selector.js`(轻量) — 输入 `{type, layout_type, data_elements, has_asset}`,读 index.json,返回**按相关度排序、上限 N(默认 4)的 reference ID 列表**(无 tokenizer,靠 keyword 匹配 + 页型规则)。纯逻辑,不抛错 | Node + 测试 | 实现"按需注入" |
| J | slide-core / content-core 接线:生成前调 reference-selector 得 ID 列表 → 读选中的小 reference 文件(替代"读全部"),保留必读核心(svg-generator/bento-grid/style) | 散文 | 控页内上下文 |

**不做**:照搬 charts HTML 模板 / css-weapons CSS-only 技法 / Akxan styles(本仓库自有 17+4)/ Akxan prompts/playbooks(耦合其工作流)/ 重型 token 预算 assembler。

## 2. reference-selector 规格

```js
selectReferences({ type, layout_type, data_elements, has_asset }, { index, cap=4 }) -> {
  ids: string[],          // 选中的 reference id,按相关度
  reason: string[]        // 每个为何入选(可观测)
}
```
选择规则(keyword + 页型,确定性):
- 一律含核心必读由 agent 固定读(svg-generator/bento-grid/style,**不经 selector**);selector 只挑**增补** reference。
- `data_elements` 含 chart/metric/数据 → `charts-catalog` + `design-cheatsheet`。
- `type=cover/section/end` → `layout-craft`(版式画法)。
- `type=comparison/process/timeline` → `blocks`(对应组件)。
- 任意页 → 可选 `color-psychology`(若 style 未显式色彩或编排器要求)。
- review/QA 上下文 → `failure-modes`(由 review-core 固定读,不一定经 selector)。
- 去重、按规则优先级排序、**截到 cap**(避免页内上下文膨胀)。
- index.json 读取失败 / 字段缺失 → 返回空 ids + reason 说明,**不抛错**(优雅降级:agent 退回读核心必读)。

## 3. 移植适配规则(每份文件)
- 文件头 frontmatter/注释:`Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。`
- charts-catalog:分类法/选型表照移(中文),**代码示例一律 SVG**(`<g transform>`/`<rect fill="${accent}">`),新图型给最小 SVG 骨架;明确"HTML/CSS 版式请勿用,本管线为 SVG"。
- design-cheatsheet:把 Akxan `cards[]/planning.json` 字段名**逐一改写**为本仓库 `pages[].{layout_type,data_elements,visual_weight,key_message,asset}`。
- layout-craft:开篇声明"本仓库 `layout_type` 枚举见 bento-grid-layout.md(10 个),本文件只深化其**画法/重力场/变体**,不新增/不改枚举,validator 不受影响。"
- blocks:每组件给"何时用 + 设计灵魂 + **SVG 落地提示**(card_style→`<rect rx fill stroke>`、glass→低透明叠色而非 backdrop-filter)"。

## 4. 测试(node:test + prose grep)
- `reference-selector.test.js`:① 数据页 → 含 charts-catalog+design-cheatsheet;② cover → 含 layout-craft;③ comparison → 含 blocks;④ 截到 cap;⑤ index 缺失/坏字段 → 空 ids 不抛错;⑥ 去重 + 排序稳定。
- `index-p4.test.js`:index.json 含 A–F 各条(domain/file_path 存在且指向真实文件)。
- 移植文件结构 grep:每份含 Akxan 署名行 + 关键锚点(failure-modes 含 8 类;design-cheatsheet 含本仓库字段名如 `layout_type`/`data_elements` 且**不含** Akxan 的 `cards[]`/`planning.json`;charts-catalog **不含** `<div`/`backdrop-filter`;layout-craft 含"不改枚举"声明)。
- ATTRIBUTIONS 存在 + 含 MIT/sunbigfly/移植清单。
- slide-core/content-core 接线 grep:含 `reference-selector`、"按需/选中 reference"。

## 5. 验收(并入 dogfood 清单)
- 数据页是否引入更专业的图型(radar/funnel/gauge)且为合法 SVG。
- 失败模式/cheatsheet 是否降低"装饰多于信息"等问题(弱信号)。
- 页内上下文未爆炸(selector 截断生效)。
- 无 HTML/CSS 误入 SVG 产物(移植适配到位的反向验证)。
- 署名合规可见。
