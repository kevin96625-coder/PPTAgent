# 版式画法深化 — 重力场哲学 · 变体手法

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: gravity-field layout philosophy + variation craft. Deepens the EXISTING 10 `layout_type` values' rendering only — adds no new enum value, touches no validator.

> **本仓库 `layout_type` 枚举见 `prompts/bento-grid-layout.md`(10 个),本文只深化画法/重力场/变体,不新增不改枚举,validator 不受影响。**

本仓库已有固定 10 值 `layout_type` 枚举(`single_focus` / `two_column_symmetric` / `two_column_asymmetric` / `three_column` / `hero_grid` / `mixed_grid` / `timeline` / `dashboard` / `horizontal_split` / `full_bleed`),由 `planning-validator.js` 硬校验。**本文件不创建平行 layout 分类法、不改这 10 个枚举**——只把 Akxan 的"重力场"哲学作为这 10 个枚举的**画法深化注解**,帮 slide-core 把同一 `layout_type` 画得更灵动。

---

## 核心哲学:版式是重力场,不是牢笼

画布是物理约束(1280×720,标题区左上 40px 起、约 50px 高,cover/section/end 可自由处理),但**不是设计边界**。真正的版式让内容**与边界对话**——有时拥抱,有时挑衅,有时让元素与边界暧昧地擦身而过。

每个 `layout_type` 定义的是一种**视觉重力的分布倾向**,而非像素级铁栅栏:
- 读到"主次(2:1)"时,获取的信息应是"左侧引力更强、右侧更轻、核心主体被吸到左侧引力场",
- 而**绝不是**"左边 790px 放一个方块,右边 390px 放两个方块"。

slide-core 应基于重力场哲学自主构建 SVG 的 `<g transform>` 分布,而非套死像素骨架。**每页至少 2 种 card_style**(见 `blocks.md`)是灵动的最低门槛。

---

## 重力场注解:把哲学映射到 10 个枚举的画法

| layout_type | 重力场描述(画法深化) | 灵动手法 |
|-------------|----------------------|---------|
| `single_focus` | 所有重力汇聚于中心或黄金分割点,四周悉数留白 | 极简主张:80% 留白 + 一句巨大论断;或单一图表黑洞 |
| `two_column_symmetric` | 左右等量重力对峙,如天平两端 | 两侧不同 accent 但结构对称;VS 跨中轴打破物理分割 |
| `two_column_asymmetric` | 重力明显偏向一侧(6:4),另一侧轻声附和 | **重力反转**:把主区从左移到右,打破"主角总在左" |
| `three_column` | 三个均衡重力池横向排列 | 据内容主次让某栏脱颖而出,避免三格等高表单感 |
| `hero_grid` | 顶部横贯的重力大坝 + 底部分散的轻量溪流(总分) | 英雄区压迫式/虚无式/图景式三种灵魂;底部子项据主次分配风格 |
| `mixed_grid` | 多个不同密度的重力点交错(含 L 型/T 型变体) | L:主体深潜→滑向侧面→沉入底部;T:顶部横贯总览 + 底部偏心深潜 |
| `timeline` | 沿时间轴的流动重力 | 轴线可微弯、highlight 处膨胀、末端渐隐;节点上下交替呼吸(详见 `blocks.md`) |
| `dashboard` | 多个均衡数据晶体的网格重力 | 4-6 卡密集但据指标重要性给 1 个 accent 核心,避免全等重 |
| `horizontal_split` | 上下两带的重力分层 | 上总下分;上带可 glass 氛围,下带 filled 承载 |
| `full_bleed` | 单一画面铺满全域的沉浸重力 | 图景式:大图 + 文字浮游(渐隐融合/底部涌现/角落低语,见 `blocks.md` image_hero) |

> **非 content 页自由度**:cover(顶格张力,巨大标题冲击 + 氛围 + 品牌印记)/ toc(极高严密,章节清晰层次递进)/ end(顶格张力,核心回顾 + CTA + 与封面呼应)。

---

## 灵动法则:如何让同一 `layout_type` 看起来截然不同

即使两页都用 `two_column_asymmetric`,也应看起来完全不同。方法:
1. **重力反转**:第一页主区在左,第二页让主区在右。
2. **存在感变奏**:第一页主卡 `accent` + 辅卡 `transparent`,第二页主卡 `elevated` + 辅卡 `outline`。
3. **密度跳变**:第一页主区塞满图表数据,第二页主区只有一句巨大金句 + 80% 留白。
4. **边界挑衅**:第一页所有元素老实待在格里,第二页让某个装饰(大号水印/数据残影)故意溢出边界。

> 灵动不是混乱。灵动是在同一套设计基因(色彩 token + 字体系统)约束下,让每页的视觉编排出人意料。

---

## 使用原则
- **内容驱动版式选择**:先问"这页内容的信息流动方式是什么",再从 10 个枚举里找最匹配的重力场,而非为了"跟上一页不一样"而刻意选不同。
- **警惕版式惯性**:连续 3+ 页同一 `layout_type` 时暂停自问——是内容真的需要,还是习惯?(对应 `failure-modes.md` 的 `deck_rhythm_clone`)
- **10 种是一套高精度约束矩阵**:一套 PPT 精准调用 4-6 种不同 `layout_type` 支撑不同表达目标,但**不得超出该枚举的物理法则,也不得新增/篡改枚举**(那会让 validator 报错)。
