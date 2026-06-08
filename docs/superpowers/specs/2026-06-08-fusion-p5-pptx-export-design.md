# P5 — PPTX 导出(方案 D:SVG 原生嵌入 MVP)设计

> 状态:设计 → 自审 → 执行(2026-06-08)。上游:`FUSION_ROADMAP.md` §P5。
> **关键认知(本会话核实,改写策略)**:`pptxgenjs`(已装于 workflow-san)**原生支持可编辑 SVG 嵌入**——它生成 `asvg:svgBlip`(MS 2016 SVG 扩展)+ `image/svg+xml` 媒体部件 + svg ContentType(实测 `pptxgen.cjs.js:1972/5550/6334`)。**故方案 D 无需手搓 OOXML / 无需 post-process**,直接用 pptxgenjs `addImage`。方案 A(svg2pptx 逐元素)**仅当方案 D 在 PowerPoint 实测保真不足时才评估**。
> **依赖**:workflow-san `html-slide-to-pptx`(pptxgenjs ^4.0.1 + jszip 传递依赖,已装);ppt-agent `render-svg.js`(M2.5,SVG→PNG 兜底)。

## 0. 范围与"先实测再定方案"原则(自审前置)

路线图明令:**先实测方案 D 保真度,再定 D vs A**。"是否在 PowerPoint 里可编辑/保真"**只能在用户机器上验证**(本会话无 PowerPoint)。因此 P5 本里程碑 = **方案 D MVP + 结构化自验**,把 PowerPoint 打开/可编辑/保真**作为用户单次 dogfood 的验收项**,据其结果再决定是否需要方案 A。**不**在保真未验证前过度投入(不先做花哨的逐元素解析、不先大改 Phase 7 全链)。

**MVP 定义**:把一次 /ppt 产出的 `output/slide-NN.svg` 整页**原生嵌入**为可编辑 SVG 的 `.pptx`(每页一张全幅 SVG + PNG 兜底),结构上经 unzip 验证正确(含 svgBlip 扩展 + 媒体部件 + ContentType),用户开机验真。

## 0.1 方案 D 的 OOXML 结构(pptxgenjs 负责生成,我们只喂数据)

每页一个全幅 picture:
```
<p:pic><p:blipFill>
  <a:blip r:embed="rId-PNG">           ← PNG 兜底(老版本/缩略图)
    <a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">
      <asvg:svgBlip xmlns:asvg=".../2016/SVG/main" r:embed="rId-SVG"/>  ← 可编辑 SVG
  </a:ext></a:extLst></a:blip>
</p:blipFill>...</p:pic>
```
pptxgenjs 在 `addImage` 收到 SVG data 时自动产出此结构 + 媒体 `.svg` + `[Content_Types]` 的 svg Default。**PNG 兜底必备**(否则不含 svgBlip 的旧 viewer 全空白;且 PowerPoint 缩略图用 PNG)。

## 1. 交付物

| # | 交付 | 位置 | 说明 |
|---|------|------|------|
| A | `svg-deck-to-pptx.js` 导出器 | workflow-san `html-slide-to-pptx/scripts/` | 输入:run output 目录(或 SVG 列表)+ 标题/accent;对每页:读 SVG → 需 PNG 兜底(若缺则尝试 render-svg 生成)→ pptxgenjs `addImage` 全幅(13.333×7.5in)原生 SVG;输出单个 `.pptx`。复用 bible-class `compose_pptx` 的"共享 PptxGenJS 实例 多页"范式。 |
| B | PNG 兜底接线 | 同上 | 优先用已存在的 `reviews/render-*.png`/`output/` 内 PNG;否则调 ppt-agent `render-svg-cli.js`(跨仓 node 调用,Chrome 缺失则**优雅降级**:无 PNG 时仍嵌 SVG 但日志告警"老 viewer 将空白",不崩) |
| C | 结构化测试 | workflow-san `tests/` 或脚本内 node:test | 用最小 fixture SVG 跑导出器 → **unzip 产出的 .pptx** 断言:① 是合法 zip;② `[Content_Types].xml` 含 svg Default;③ `ppt/media/` 含 .svg 与 .png;④ 每 slide XML 含 `asvg:svgBlip` 且 r:embed 指向真实 svg 媒体;⑤ 幻灯片数 = SVG 数;⑥ presentation.xml 引用全部 slide。 |
| D | ppt-agent 交付facade接线 | `commands/ppt.md` Phase 7 | 交付期在产出 SVG/HTML 后,**额外**调 A 生成 `output/presentation.pptx`(尽力而为:导出器/依赖缺失则跳过并提示,不阻塞既有交付)。记一行到交付 README:用户用 PowerPoint 2016+ 打开验证可编辑性。 |
| E | `ppt/export` 文档化 | `commands/ppt.md` 或 CLAUDE.md | 说明统一导出门面:**SVG 输入→方案 D**(本里程碑);HTML 输入→复用 bible-class storybook(已存在,交叉引用)。MVP 只实 SVG 路。 |
| F | dogfood 验收项 | 入口文档 | 新增 P5 验收:PowerPoint 打开 presentation.pptx → 是否每页显示、是否可点选/编辑 SVG、保真是否够用 → 据此定 D 够用 / 需 A。 |

**不做(保真未验证前)**:方案 A 逐元素解析、svg2pptx 移植、Phase 7 大重构、HTML→pptx 新路(已有 storybook)、动画/母版美化。

## 1.1 跨仓架构(沿用 bible-class 范式)

转换器代码在 **workflow-san**(pptxgenjs 之家);ppt-agent 侧只在 `commands/ppt.md` 散文里**调用**它(`node ../ppt-agent-workflow-san/html-slide-to-pptx/scripts/svg-deck-to-pptx.js ...`),与 bible-class Plan4 同构。路径用相对定位 + 存在性探测,缺失则跳过。

## 2. 导出器接口

```
node svg-deck-to-pptx.js \
  --in <run_output_dir>        # 含 slide-NN.svg(+ 可选 images/、已渲染 png)
  --out <path/presentation.pptx>
  --title "<deck 标题>"        # 进 pptx core props
  [--png-dir <dir>]           # 兜底 PNG 来源(缺则尝试 render-svg)
  [--render-svg-cli <path>]   # ppt-agent render-svg-cli.js 路径(用于现生成 PNG)
```
- 每页 SVG 作为 data URI(`data:image/svg+xml;base64,...` 或 pptxgenjs 接受的形式)+ PNG 兜底,`addImage({ x:0,y:0,w:'100%',h:'100%' })` 全幅。
- 顺序按 `slide-NN.svg` 数字排序。
- `<image href="images/..">` 相对引用:SVG 内嵌入前需把外链图**内联为 data URI**(否则 pptx 内 SVG 找不到外部文件)——这是关键适配点(见 §3 风险 1)。
- 容错:任一页失败 → 记录跳过该页(或用纯 PNG 兜底页),不中断整 deck;全失败 → 非零退出 + 清晰报错。

## 3. 风险与自审

1. **🔴 外链图问题**:M2.5 让 SVG 用 `<image href="images/slide-NN.jpg">` **相对外链**(为省 Gemini token)。嵌入 pptx 后,SVG 媒体部件是孤立文件,**相对 href 解析不到 → 资产页图片在 PowerPoint 里破图**。→ **必须在导出前把 SVG 里的外链 `<image href>` 内联成 base64 data URI**(读图文件→base64→替换 href)。导出器含此预处理步。测试覆盖:含外链图的 SVG 导出后,媒体 .svg 内 href 为 data URI。
2. **PNG 兜底依赖 Chrome**:render-svg 需 headless Chrome。缺失→无 PNG。pptxgenjs 的 svgBlip 仍需一个 blip 主体(PNG)。→ 若无 PNG,**用一个 1×1 透明或纯背景色占位 PNG 兜底**(保证结构合法),并告警。不让"无 Chrome"阻断导出。
3. **pptxgenjs SVG API 形态**:需实测 `addImage` 接受 SVG 的确切形式(path vs data;是否必须同时给 PNG)。导出器实现时先写一个最小验证脚本确认 API,再批量。
4. **可编辑性/保真 = 用户机器验证**:本会话只能验 zip/XML 结构正确;PowerPoint 实际渲染/可编辑/字体回退/中文显示**必须用户验**。诚实写入验收项,不声称"已可用"。

## 4. 验收
- 结构测试全绿(unzip 断言 svgBlip/媒体/ContentType/页数)。
- 对 su7 等既有 output 跑导出器 → 得 `presentation.pptx`(本会话验结构,不验 PowerPoint)。
- **用户单次 dogfood**:PowerPoint 2016+ 打开 → 每页显示正常?可点选编辑 SVG?中文/字体正常?资产页图片在(外链已内联)?保真够用→方案 D 收官;不够→记录差距,评估方案 A。
- 既有 SVG/HTML 交付不受影响(pptx 是 additive,失败不阻塞)。
