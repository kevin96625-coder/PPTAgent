# P4 执行计划 — 资源注入(Akxan 适配移植 + 轻量选择器)

> spec(单一来源,务必读):`specs/2026-06-08-fusion-p4-resource-injection-design.md`。
> Akxan 源已 clone:`/tmp/akxan-probe`(MIT © 2025 sunbigfly)。**移植即适配**——SVG 模型 + 本仓库 outline schema + 不与现有 reference 冲突 + 署名。
> 工作目录 `/Users/kevinchen/PPT_Agent/ppt-agent`,直提 main。测试 node:test。

## 阶段一:内容移植(适配)
按 spec §1 A–F + §3 适配规则,从 `/tmp/akxan-probe/references/` 读源、**适配后**写入 `skills/_shared/references/`:

- **Task A** `principles/failure-modes.md` ← Akxan `principles/failure-modes.md` + `runtime-failure-modes.md` 整合。8 类失败模式 + 修复优先序;术语映射到本仓库(outline/SVG/review-core)。署名头。
- **Task B** `design-cheatsheet.md` ← Akxan `principles/design-principles-cheatsheet.md`。**逐字段改写**:Akxan `cards[]`/`planning.json` → 本仓库 `pages[].{layout_type,data_elements,visual_weight,key_message,asset}`。grep 自检:不得残留 `cards[`/`planning.json`。
- **Task C** `blocks.md` ← Akxan `blocks/*.md` 整合(card-styles 6 变体/timeline/diagram/quote/comparison/people/image-hero/matrix)。每组件:何时用 + 设计灵魂 + **SVG 落地提示**(glass=低透明叠色非 backdrop-filter;card_style→`<rect rx fill stroke>`)。**不含 HTML 代码**。
- **Task D** `charts-catalog.md` ← Akxan `charts/{index,basic,advanced,complex}.md`。移分类法 + 选型矩阵 + 设计灵魂;新图型 radar/funnel/gauge/waffle 给**本仓库 SVG 习语最小骨架**(`<g transform>`/`<rect fill="${accent}">`/`<polygon>`);开篇交叉引用 svg-generator 既有 chart 段(不重复 Big Number/Progress/Donut)。grep 自检:不得含 `<div`/`backdrop-filter`。
- **Task E** `color-psychology.md` ← Akxan `principles/color-psychology.md`。60/30/10 + 情绪 + 对比;开篇呼应 P3 `color_ratio`(style YAML 已声明预算)。
- **Task F** `layout-craft.md` ← Akxan `layouts/{hero-top,l-shape,t-shape,waterfall,primary-secondary}.md` + README 重力场哲学。**开篇声明**:"本仓库 layout_type 枚举见 bento-grid-layout.md(10 个),本文只深化画法/重力场/变体,**不新增不改枚举**,validator 不受影响。"
- 每份文件头加 spec §3 的 Akxan 署名 + "通用规范非原帖" 行。

## 阶段二:署名 + 注册
- **Task G** `ATTRIBUTIONS.md`(仓库根):Akxan/ppt-agent-skill MIT © 2025 sunbigfly + 移植文件清单 + 链接;注明"已适配本仓库 SVG/schema"。
- **Task H** index.json:为 A–F 加条目,沿用现有 schema(id/domain/name/file_path/keywords/description/use_cases)。新 domain:`principle`(failure-modes/color-psychology)、`block`、`chart`、`reference`(design-cheatsheet/layout-craft 可归 `prompt` 或新 `craft`——择一致)。keywords 带页型/数据特征(chart/metric/cover/comparison/process/color)。

## 阶段三:选择器 + 接线(TDD)
- **Task I** `lib/reference-selector.js` + CLI + 测试,见 spec §2。`selectReferences({type,layout_type,data_elements,has_asset},{index,cap=4})`;读 index.json(JSON.parse,无依赖);规则映射;去重/排序/截 cap;index 坏/缺 → 空 ids + reason,不抛错。CLI `reference-selector-cli.js --type --layout --data-elements --index` 输出 JSON,exit 0。测试 spec §4 六条。
- **Task J** 接线:
  - slide-core.md:生成前"按页型用 reference-selector 取增补 reference 列表并读取"(核心必读 svg-generator/bento-grid/style 仍固定读);明确 selector 失败则退回只读核心。
  - content-core.md:大纲/策划阶段同理可取 design-cheatsheet/failure-modes。
  - review-core.md:QA 固定读 `failure-modes.md`(修复优先序)。
  - prose grep 锚点:`reference-selector`、`failure-modes`、"选中/按需 reference"。

## 阶段四:测试 + 自检
- `index-p4.test.js`:index 各新条 file_path 指向真实存在文件。
- 移植结构 grep 测试:署名行;failure-modes 8 类;design-cheatsheet 含 `layout_type`/`data_elements` 且无 `cards[`/`planning.json`;charts-catalog 无 `<div`/`backdrop-filter`;layout-craft 含"不改枚举/不新增"声明。
- `cd skills/_shared && npm test` 全绿。

## 执行
- 子代理:阶段一→二→三→四顺序;选择器 TDD。
- 完成 → 多代理对抗审核(重点:① 移植是否真适配 SVG/schema、有无 HTML/Akxan 字段漏网;② layout-craft 是否与 10 枚举冲突;③ selector 是否真被 agent 调用且降级正确;④ 署名合规)→ 修 → 回填路线图。
- 清理:审核后可 `rm -rf /tmp/akxan-probe`。

## DoD
- A–F 移植文件就位且**适配到位**(SVG 习语 + 本仓库 schema + 无 HTML/Akxan 字段残留 + 不碰 layout 枚举);ATTRIBUTIONS 合规;index 注册;selector+CLI 测试绿 + 接线;全测试绿。
- 路线图 P4 标 ✅,记忆回填。
