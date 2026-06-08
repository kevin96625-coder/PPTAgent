# P3 — 排版阶梯 + 60/30/10 配色(安全瘦版)设计

> 状态:设计 → 自审 → 执行(2026-06-08)
> 上游路线图:`FUSION_ROADMAP.md` §P3。依赖:M2.6(确定性自修,14px 下限已强制)。
> 来源校正:7 级字号阶梯 / 60-30-10 配色 **非原帖**,属"通用设计规范",标"待复核",勿挂原帖。

## 0. 为什么是"安全瘦版"(自审前置)

上一轮对 P3 的自审结论(已写进路线图/记忆):**P3 与 Gemini 现有审查重叠,且有 M2.6 同款回退风险。** 具体:

1. **重叠**:Gemini holistic 审查已含 "Color Story 20%" 维度;reviewer.md 已有字号≥14 硬规则。再加一个"看着像但做不出好 PPT"的硬门 = 重复造门 + 噪声。
2. **回退风险**:M2.6 的血泪教训是——**任何确定性"自动改写"都可能把对的改坏**(把刻意放在亮徽章上的深色字改糊、把全出血 hero 标题误判)。字号/配色若做"自动吸附到阶梯/自动改配色比例",必然重蹈覆辙:把一个精调到 38px 刚好容纳的标题吸附成 36px 会撑破,把一块刻意的大面积强调色"修正"成中性色会毁掉设计意图。

**因此 P3 的铁律(继承 M2.6 哲学)**:
- **只增不改**:P3 **绝不自动改写 SVG**。不进 `svg-autofix.js`。
- **只软不硬**:P3 校验器**只产软警告(soft-warn),绝不硬阻塞(hard-block),绝不触发 fix loop**。
- **生成期引导优先**:真正的价值在**生成期**——给 slide-core 一份明确的字号阶梯 + 配色预算,让它一次画对;校验只是事后给编排器/reviewer 的**廉价确定性信号**,补 Gemini 看不到的角度(Gemini 不会去数"这页用了几种字号")。

这样 P3 = 纯增益:画得更规范(生成引导)+ 多一个不花钱的确定性体检项(软警告),**零回退面**。

## 1. 交付物总览

| # | 交付 | 类型 | 性质 |
|---|------|------|------|
| A | style YAML 增 `typography_ladder`(7 级,每级 px + 用途)+ `color_ratio`(60/30/10 预算 + 各 token 归桶) | 数据(18 个 style 文件 + schema 文档) | 纯增字段,向后兼容 |
| B | `references/typography-ladder.md` 参考文档(7 级阶梯规范 + CJK 注意) | 文档 | 生成引导 |
| C | `lib/type-scale.js` — 统计 SVG 内**不同字号种数 + 落在阶梯外的字号**,软警告 | Node 纯逻辑 + CLI | 只读分析,绝不改 SVG |
| D | `lib/color-ratio.js` — 从 SVG 几何**估算**面积加权配色分布,按桶比对 `color_ratio` 预算,宽容差软警告 | Node 纯逻辑 + CLI | 只读分析,绝不改 SVG |
| E | slide-core.md 接线:生成期引用阶梯 + 配色预算;生成后跑 C/D 但**只记录软警告**(不阻塞、不进 fix loop) | 散文接线 | — |
| F | reviewer.md / review-core:把 C/D 的软警告作为**确定性补充信号**传给 Gemini(供其参考,不作硬门) | 散文接线 | — |

**不做**(刻意排除,避免回退/重叠):
- ❌ 不自动改写任何字号或颜色(不进 autofix)。
- ❌ 不把字号阶梯/配色比例做成硬阻塞门或 fix-loop 触发器。
- ❌ 不重复实现 WCAG 颜色数学(复用 `color-contrast.js` 的 `hexToRgb`/`relLuminance`)。
- ❌ 不做像素级渲染采样配色(太重、噪声大);只做 SVG 几何面积估算 + 宽容差 + 软警告。

## 2. 数据契约

### 2.1 `typography_ladder`(style YAML 新增,单一来源)

7 级,值为 **base px(scale=1.0 时)**,实际渲染再乘 `typography.scale` 与 per-type `heading_scale`。来自现有 `svg-generator.md` 已硬编码的字号区间,**收敛成离散阶梯**(不是新规矩,是把已有区间规整):

```yaml
typography_ladder:           # base px @ scale 1.0; 实际 = base * typography.scale * (type override)
  h1: 64        # 封面/区隔大标题、hero 数字(原 48-72 → 取 64 档)
  h2: 40        # 页面主标题(原 36-44 → 取 40 档)
  h3: 28        # 卡片标题/小节标题(原 24-32 → 取 28 档)
  body: 18      # 正文(社区反馈下限 16;取 18)
  label: 15     # 标签/坐标轴/图例(≥14 floor;取 15)
  caption: 14   # 脚注/出处(≥14)
  micro: 12     # 页码/角标(唯一允许 <14 的角色,data-role=page-number/label)
```

- 字号阶梯是 **推荐档位**,不是唯一合法值——C 校验器只在"不同字号种数过多"或"明显偏离任一档位过远"时软警告(见 §3.1)。允许 hero 数字等特例偏离。
- `micro=12` 与 M2.6 的 label/footnote 12px floor 一致,不冲突。

### 2.2 `color_ratio`(style YAML 新增)

声明 60/30/10 **设计意图 + token 归桶**(让校验器知道哪些 token 属哪桶):

```yaml
color_ratio:                 # 设计意图预算(面积占比),非硬约束
  dominant: 60               # 主导(通常 background)
  secondary: 30              # 次级(primary/secondary/card_bg)
  accent: 10                 # 强调(accent + chart[0])
  buckets:                   # 把 color_scheme 的 token 归到三桶(校验器据此分类 fill)
    dominant: [background]
    secondary: [primary, secondary, card_bg, text]
    accent: [accent]
```

- `buckets` 是关键:校验器把 SVG 里每个 fill 的 hex **就近匹配**到某 token,再归桶累加面积。匹配不到的 hex(渐变/图表多色/装饰)归 `other`,不计入比例分母(避免 chart 多色污染主比例)。
- 暗色/深色封面 style 的 dominant 是深色背景——`buckets.dominant` 仍指 `background` token,逻辑通用。

## 3. 校验器规格

### 3.1 `type-scale.js`

```js
analyzeTypeScale(svg, { ladder, scale=1.0 }) -> {
  distinctSizes: number,        // 不同 font-size 的种数
  sizes: number[],              // 排序后的去重字号
  offLadder: [{ size, nearest, deltaPct }],  // 偏离最近档位 >25% 的字号
  warnings: [{ code, detail }]  // 软警告
}
```

软警告规则(**只警告,永不报错**):
- `too-many-sizes`:`distinctSizes > 6` → "字号种数过多(N),易成视觉噪声;建议收敛到阶梯 7 档内"。**这是首要稳健信号**——对 scale 不敏感。
- `off-ladder`:某字号距最近档位相对偏差 >25% 且该字号 ≥14(放过 micro)→ 记入 offLadder,**汇总成一条提示**(不逐条刷屏)。**[自审补丁 #4 — scale 解析]** 档位需乘**已解析的有效 scale**(`typography.scale × per-type heading_scale`)才能比对,否则封面(heading_scale 1.3)/数据页(0.9)会误报 off-ladder。`analyzeTypeScale` 接受可选 `effectiveScale`(slide-core 知道页型时传入);**未传入时,off-ladder 标记为 best-effort 且降权为纯信息**,只保证 `too-many-sizes` 这一稳健信号。
- 解析:正则抓 `font-size="N"`(与 autofix 同款无 XML 依赖),忽略 `data-decorative="true"` 文本。

### 3.2 `color-ratio.js`

```js
analyzeColorRatio(svg, { colorScheme, colorRatio }) -> {
  distribution: { dominant, secondary, accent, other },  // 归一化占比(0-1,基于已分类面积)
  budget: { dominant:0.6, secondary:0.3, accent:0.1 },
  deviations: [{ bucket, actual, target, deltaPP }],
  warnings: [{ code, detail }],
  caveat: string                // 明确标注"基于 SVG 几何估算,非像素真值"
}
```

面积估算(只数**明确填充**的基本形,保守):
- `<rect w h>` → w×h;`<circle r>` → π r²;`<ellipse rx ry>` → π rx ry。`<path>`/复杂形 → **跳过**(无可靠面积),计入"已知不全"。
- 取每个形的 `fill="#hex"`;无显式 fill / `url(#grad)` / 图片 → 归 `other`。
- hex 就近匹配 token(欧氏 RGB 距离 < 阈值 48 视为同桶;否则 `other`)。复用 `color-contrast.hexToRgb`。
- `data-decorative="true"` 的形仍计面积(装饰也占视觉面积),但极小阈值(<0.5% 画布)忽略。
- 归一化:`dominant/secondary/accent` 三桶面积 ÷ 三桶总面积(剔除 other),得占比。

**[自审补丁 #2 — 不足面积守卫]** 先算"可测量面积" = 所有已分类基本形面积之和。若可测量面积 < 画布的 30%(即大部分版面是 path/渐变/图片/图表,几何估算不可信)→ **直接返回 `insufficient_area: true`,不产任何配色软警告**,只附 caveat。这避免对照片主导页 / path 密集页给出基于极小样本的误导比例。M2.5 全出血 hero / 图主导页正属此类,会被自动跳过。

软警告规则(满足可测面积阈值时;**只警告,永不报错**,宽容差):
- `accent-overload`:accent 实际占比 > 25%(预算 10%,容差到 25%)→ "强调色面积偏大,可能稀释重点"。
- `no-dominant`:dominant 占比 < 35%(预算 60%)→ "缺少主导背景色,版面可能花乱"。
- 其余偏差只记入 `deviations` 供参考,不单独刷警告。
- **永远附 `caveat`**:估算基于基本形几何,path/渐变/图片未计入;仅作方向性参考。

### 3.3 CLI

两个共用一个 `type-color-cli.js`(或各自 cli,按 _shared 既有约定),输入 `--svg <path> --style <yaml>`,输出 JSON 报告,**exit code 恒为 0**(软警告不阻塞 CI / 不让编排器误判失败)。

## 4. 接线(散文,生成期为主)

### 4.1 slide-core.md
- "SVG Requirements / Typography" 段:引用 `typography_ladder` 7 档与 `references/typography-ladder.md`,要求字号**就近选档**(hero 数字可特例);引用 `color_ratio` 预算,要求大面积用 dominant、强调色克制(~10%)。
- "Post-Generation Validation" 段:在既有校验后追加一步——跑 `type-scale` + `color-ratio`,**把软警告写入 slide-status / 传给编排器作参考,但不阻塞、不触发重画、不进 fix loop**。明确写:"these are advisory; never auto-rewrite, never block."

### 4.2 reviewer.md / review-core.md
- review-core 调 Gemini 前,附上 C/D 的软警告作为"确定性补充观察(determinstic hints)",让 Gemini 决定是否采纳。**不**新增 Gemini 硬规则(避免与 Color Story 维度重复成硬门)。
- reviewer.md 在 Quality Standards 里**不**加新硬阻塞项;只在"参考信号"处说明可消费这些 hints。

## 5. 测试(node:test,_shared 约定)

- `type-scale.test.js`:① distinctSizes 计数正确;② >6 触发 too-many-sizes;③ 阶梯内字号不警告;④ 偏离档位 >25% 记入 offLadder;⑤ micro/装饰被放过;⑥ **永不抛错、永不返回 hard error**(回退红线测试)。
- `color-ratio.test.js`:① rect/circle/ellipse 面积计算正确;② token 归桶 + 就近匹配;③ accent 过载触发软警告;④ chart 多色归 other 不污染分母;⑤ path/渐变跳过 + caveat 存在;⑥ **永不抛错、exit 0**(回退红线)。
- 红线测试(贯穿):喂一个精调好的真实 SVG(从既有 fixtures 取),断言 **输出 svg 与输入逐字节相同**(证明 P3 绝不改写)——其实 C/D 根本不返回 svg,此测试转为"模块无任何写 SVG 的导出"。
- style YAML 结构 grep 测试:18 个 style 都含 `typography_ladder`(7 键)+ `color_ratio`(buckets 三桶)。

## 6. 验收(并入下次 dogfood 清单)
- slide-status / 审查产物里出现 `type-scale` / `color-ratio` 软警告字段(证明跑通)。
- 软警告**未**导致额外 fix 轮次(对比基线 fix-rounds 不升)。
- 字号种数中位数下降 / accent 过载页减少(生成引导见效,弱信号)。
- **零回退**:无任何"自动改写把对的改坏"——因为 P3 不改写,结构上保证。
