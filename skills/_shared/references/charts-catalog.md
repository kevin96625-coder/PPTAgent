# 图表目录 — 分类法 · 选型矩阵 · 新图型 SVG 骨架

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: chart taxonomy + selection matrix + design soul. Akxan's HTML/CSS chart code is NOT copied. New chart types (radar/funnel/gauge/waffle) are rewritten as MINIMAL pure-SVG skeletons in this repo's idiom (`<g transform>`, `<polygon>`, `<rect fill="${accent}">`). This repo emits SVG, not HTML — no markup-element div, no CSS backdrop filters.

本仓库为**纯 SVG** 管线(1280×720 viewBox,`${token}` hex 填充)。**Akxan 的 HTML/CSS 图表模板不可用**——会产出本管线无法渲染的标记。本文件只移植**分类法 + 选型决策 + 设计灵魂**,并为本仓库缺失的高价值新图型给**最小 SVG 骨架**。

**交叉引用(不重复)**:`prompts/svg-generator.md` 的 Data Visualization 段已给出 Big Number / Progress Bar / Sparkline / Donut / Horizontal Bar / Timeline / Table 的 SVG 模板——那些**不在此重复**,直接用。本文件补的是 svg-generator 没有的:**radar / funnel / gauge / waffle** + 全图型选型矩阵。

---

## 1. 图表全景(按层级)

| 图表 | 层级 | 何时用 | 落地位置 |
|------|------|-------|---------|
| 进度条 Progress | 基础 | 单一百分比 / 完成度 | svg-generator(已有) |
| 大数字 Big Number | 基础 | 单一核心 KPI | svg-generator(已有) |
| 对比柱 Bar | 基础 | 2-8 项对比 / 排名 | svg-generator(已有) |
| 环形 Donut | 基础 | 部分占整体(≤6 段) | svg-generator(已有) |
| 迷你折线 Sparkline | 基础 | 趋势方向 | svg-generator(已有) |
| 时间线 Timeline | 基础 | 流程 / 里程碑 | svg-generator + `blocks.md` |
| **点阵 Waffle** | 基础 | 比例直觉化(10×10) | **本文 §3** |
| **雷达 Radar** | 进阶 | 多维度对比(5-8 维) | **本文 §3** |
| **漏斗 Funnel** | 进阶 | 转化率 / 流失分析 | **本文 §3** |
| **仪表盘 Gauge** | 进阶 | KPI 评级 / 健康度 | **本文 §3** |
| 多组对比柱 Grouped Bar | 进阶 | 多类别 × 多组 | svg-generator Bar 扩展(`chart_colors[i]` 每组) |

> 复杂图(世界地图 / 关系网络 / 桑基 / 热力日历)对单页 PPT 通常过重,优先拆解为更简单的图;确需时用纯 SVG `<path>` 静态计算,**禁止引入 ECharts 等运行时**。

---

## 2. 选型决策矩阵(按数据特征)

| 数据特征 | 首选 | 备选 |
|---------|------|------|
| 单一百分比 | 进度条 / 环形 | 大数字 |
| 单一核心 KPI | 大数字 | 仪表盘 |
| 2-8 项对比 / 排名 | 对比柱 | 多组对比柱 |
| 部分占整体(≤6) | 环形 | 点阵 |
| 比例直觉化 | **点阵** | 环形 |
| 多维度评估(5-8 维) | **雷达** | 评分指示器 |
| 时间趋势 | 迷你折线 | 时间线 |
| 转化漏斗 / 流失 | **漏斗** | 多组对比柱 |
| KPI 评级 / 健康度 | **仪表盘** | 评分指示器 |
| 流程 / 里程碑 | 时间线 | 漏斗 |
| 2×2 战略定位 | 象限矩阵(`blocks.md`) | — |

**通用规范(本仓库)**:① 颜色只用语义 token 与 `chart_colors[]`,不硬编码 hex;② 数字用 `<text>` 直接标注在图元附近(避免独立图例);③ 单页图表保持简单——这是 PPT 不是 dashboard;④ 数据 >10 点优先用表格卡而非图表;⑤ 三角/箭头用 `<polygon>`(禁止 CSS border 三角)。

---

## 3. 新图型最小 SVG 骨架(本仓库习语)

> 以下骨架用 `<g transform>` / `<polygon>` / `<rect fill="${accent}">` / `<text>`,坐标可按数据重算。文字直接用 SVG `<text>`(本仓库渲染 SVG,与 Akxan 的"标签外挂"规则无关)。

### 3.1 雷达图 Radar — 多维度对比(5-8 维)
**何时用**:5-8 维多面对比(能力评估、品牌健康度)。<5 维用指标行,>8 维拆分。
**坐标公式**:`θ_i = -90° + i·(360°/N)`;顶点 `(cx + r·cosθ, cy + r·sinθ)`;数据顶点半径 `r·(value/max)`。
```xml
<g transform="translate(200,180)">
  <!-- 背景网格:多层多边形(5 圈刻度),此处示 6 维外圈 -->
  <polygon points="0,-90 77.9,-45 77.9,45 0,90 -77.9,45 -77.9,-45"
    fill="none" stroke="${text}" stroke-opacity="0.25"/>
  <polygon points="0,-45 38.9,-22.5 38.9,22.5 0,45 -38.9,22.5 -38.9,-22.5"
    fill="none" stroke="${text}" stroke-opacity="0.15"/>
  <!-- 轴线:从圆心到各顶点 -->
  <line x1="0" y1="0" x2="0" y2="-90" stroke="${text}" stroke-opacity="0.2"/>
  <!-- 数据多边形(半透明填充 0.18-0.25) -->
  <polygon points="0,-79 67,-39 70,34 0,72 -54,31 -62,-36"
    fill="${chart_colors[0]}" fill-opacity="0.22"
    stroke="${chart_colors[0]}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="0" cy="-79" r="3" fill="${chart_colors[0]}"/>
  <!-- 维度名:SVG text,放在各顶点外侧 -->
  <text x="0" y="-100" text-anchor="middle" font-size="12" fill="${text}">性能</text>
</g>
```
多系列:再叠一个 `<polygon fill="${chart_colors[1]}">`。背景刻度建议 5 圈便于读数。

### 3.2 漏斗图 Funnel — 转化率 / 流失
**何时用**:多阶段转化(曝光→点击→下单→复购)。逐层收窄,层宽 ∝ 数值。
```xml
<g transform="translate(440,120)">
  <!-- 每层用对称梯形(<polygon>),宽度随转化率收窄;颜色 chart_colors 渐变 -->
  <polygon points="0,0 400,0 360,56 40,56" fill="${chart_colors[0]}"/>
  <polygon points="40,64 360,64 320,120 80,120" fill="${chart_colors[1]}"/>
  <polygon points="80,128 320,128 290,184 110,184" fill="${chart_colors[2]}"/>
  <!-- 数值与阶段名:SVG text 居中叠在每层上 -->
  <text x="200" y="36" text-anchor="middle" font-size="16" fill="#fff">曝光 100%</text>
  <text x="200" y="100" text-anchor="middle" font-size="16" fill="#fff">点击 42%</text>
  <!-- 流失标注可在右侧用小号 text -->
</g>
```
有立场时把关键转化层用 `fill="${accent}"` 突出。

### 3.3 仪表盘 Gauge — KPI 评级 / 健康度
**何时用**:单一指标的"评级"语义(健康度 78/100、满意度评分)。半圆弧 + 指针/填充弧。
```xml
<g transform="translate(200,200)">
  <!-- 底弧(半圆,A 命令画 180°) -->
  <path d="M -120,0 A 120,120 0 0 1 120,0" fill="none"
    stroke="${card_bg}" stroke-width="18" stroke-linecap="round"/>
  <!-- 值弧:按 value/max 计算终点角(此处 78% → 角度 180−0.78·180=39.6°,终点 (120cos39.6°, −120sin39.6°)≈(92,−76)) -->
  <path d="M -120,0 A 120,120 0 0 1 92,-76" fill="none"
    stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
  <!-- 中心读数 -->
  <text x="0" y="-10" text-anchor="middle" font-size="40" font-weight="bold" fill="${text}">78</text>
  <text x="0" y="14" text-anchor="middle" font-size="13" fill="${text}" opacity="0.6">健康度</text>
</g>
```
值弧终点 = `(cx + r·cos(180°−ratio·180°)·…)`,按比例算 `A` 命令终点坐标。

### 3.4 点阵图 Waffle — 比例直觉化(10×10)
**何时用**:把一个百分比变成"100 格里填了 N 格"的直觉对比(如 87% → 87 格 accent)。
```xml
<g transform="translate(440,140)">
  <!-- 10×10 网格,每格 18×18,间距 4;前 N 格 accent,其余 card_bg -->
  <!-- 第 1 行示例(实际生成 100 个 rect,row=floor(i/10), col=i%10) -->
  <rect x="0"  y="0" width="18" height="18" rx="3" fill="${accent}"/>
  <rect x="22" y="0" width="18" height="18" rx="3" fill="${accent}"/>
  <rect x="44" y="0" width="18" height="18" rx="3" fill="${accent}"/>
  <!-- ... 已填 N 格用 ${accent},未填用 fill="${card_bg}" -->
  <text x="0" y="240" font-size="22" font-weight="bold" fill="${accent}">87%</text>
</g>
```
格坐标:`x = col*22, y = row*22`;`i < N` 用 `${accent}`,否则 `${card_bg}`。

---

## 4. 自检清单(每个图表)
- [ ] 颜色全部用语义 token / `chart_colors[]`,不硬编码 hex
- [ ] 数字直接 `<text>` 标注,无独立图例(除非必要)
- [ ] 三角/箭头用 `<polygon>`,无 CSS border 三角
- [ ] 无任何 HTML 标记、无 CSS-only 技法(本管线为 SVG)
- [ ] 单页图表简单清晰,数据 >10 点改用表格卡
- [ ] 至少给一组示例数据
