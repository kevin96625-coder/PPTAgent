# 色彩心理与运用 — 60/30/10 · 情绪 · 对比安全

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: color psychology + 60/30/10 + contrast safety. CSS-var refs rewritten to this repo's semantic style tokens (`background`/`card_bg`/`accent`/`text`); ties into P3 `color_ratio`. Not Akxan's `--css-var` runtime.

色彩不是装饰,它是无声的语言。选错颜色比选错字体危害更大。**封面页、章节页、需要情绪校准的转折页应引用本原则。**

**与 P3 呼应**:本仓库风格 YAML 已声明 `color_ratio` 预算(60/30/10 的 dominant/secondary/accent 分桶),slide-core 按该预算落色;本文件是其**理论侧**。`type-color-cli.js` 会产出 `accent-overload`/`no-dominant` 等软信号(advisory)。

## 60/30/10 法则

设计界铁律,控制色彩比例:

| 比例 | 角色 | 效果 | 本仓库语义 token |
|------|------|------|------------------|
| **60%** | 主色(大面积背景) | 奠定基调 | `background`(dominant 桶) |
| **30%** | 辅色(内容载体) | 承载信息 | `card_bg`(secondary 桶) |
| **10%** | 强调色(点缀) | 引导视线 | `accent`(accent 桶) |

- 强调色是"调味料",用多了整盘菜就毁了。
- 同页最多同时用 2 种 accent。
- 大面积使用 accent = 它不再是强调色(`accent-overload` 软信号会亮)。

## 色彩情感映射

| 色系 | 传达情感 | 适用场景 |
|------|---------|---------|
| 蓝色系 | 信任、专业、科技 | 企业汇报、技术方案、金融 |
| 绿色系 | 增长、自然、健康 | 环保、医疗、教育 |
| 红/橙色系 | 紧迫、热情、活力 | 营销、促销、运动 |
| 紫色系 | 创新、高端、神秘 | 科技创新、奢侈品、创意 |
| 灰色系 | 中性、优雅、极简 | 顾问报告、法律、建筑 |
| 暗色系 | 专业、沉稳、科技感 | 开发者、深度分析、产品发布 |

**注意**:色彩情感有文化差异。红色在中国是喜庆,在西方财务语境是亏损。

## 对比度安全

文字必须可读,这是底线不是选项:
- 深色背景 → 浅色文字(白 / 70% 白)
- 浅色背景 → 深色文字(黑 / 深灰)
- accent 色文字只用于标题/数据/标签,不用于正文段落
- 最小对比度比 **4.5:1**(WCAG AA);本仓库 `color-contrast.js` / review-core 会校验

## 色彩一致性
- 所有颜色通过语义 token 引用(`background`/`card_bg`/`accent`/`text`/`heading_text`),**禁止硬编码 hex**(Zone 1 规则;图表色走 `chart_colors[]`,见 slide-core)。
- 同一章节内 accent 保持一致。
- 跨章节可用同一 accent 的不同色阶递进(浅→深),暗示叙事推进。

## 自检
- 页面色彩比例是否接近 60/30/10(对照 `color_ratio` 预算)?
- accent 是否只用在需要引导注意力的地方?
- 灰度模式下(去掉所有颜色),信息层级是否仍清晰?
