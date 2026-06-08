# 设计原则速查表 — outline.json 字段级操作手册

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: CRAP guardrail + scene-strength table. EVERY field reference rewritten from Akxan's planning fields to this repo's `pages[].{type,layout_type,data_elements,visual_weight,key_message,asset}`. NOT Akxan's planning schema.

用途不是讲理论,而是告诉 content-core / slide-core:当 `outline.json` 某个字段写得不对,应该改哪一项。content-core 在大纲/策划阶段、slide-core 在自检时可参考。

> CRAP(Contrast / Repetition / Alignment / Proximity)在本流程里是**版式 guardrail**,不是新风格系统,也不是新模板库。它不覆盖风格 YAML 的 `design_soul`,也不改 `layout_type` 枚举,只约束这些合同如何被更清楚地执行。

**本仓库字段(单一真源:`prompts/outline-architect.md`)**:每页 `pages[]` 含 `index` / `type`(content|data|comparison|process|quote|image)/ `layout_type`(10 枚举)/ `data_elements[]`(`metric`/`chart`/...)/ `visual_weight`(low|medium|high)/ `key_message`(本节一句话要点,在 part 级)/ `asset`(是否需要真实图片)。

---

## CRAP 接入原则

### 冲突优先级
当 CRAP 与既有预设看起来冲突时,按此顺序判断:
1. `requirements.md` / `outline.json` 真源优先
2. 页面 `type` 与 `visual_weight` 优先(它们等价于场景强度)
3. CRAP 只管版式秩序,不管风格灵魂(风格灵魂在 style YAML)
4. 保证"同宗不同脸",防止 Repetition 退化成模板复制

### 四句短定义
- **Contrast**:决定谁先被看到,谁必须退后
- **Repetition**:决定同语义角色是否说同一种视觉语言,而不是页页重造系统
- **Alignment**:决定元素归属哪套共同骨架,而不是随意漂浮
- **Proximity**:决定相关信息是否自然成组,而不是靠文字解释关系

### 场景强度表(按页面 `type` 推断版式力度)

| 页面 type / 语气 | Contrast | Alignment | Repetition | Proximity |
|-----------------|----------|-----------|------------|-----------|
| cover/section(开场) | 强,可做 hero 压差 | 中,允许更自由重力 | 中,保语法不保长相 | 中,避免把页面收死 |
| content(论述) | 中强,服务判断先后 | 中高 | 中高 | 高,论点/依据/行动成组 |
| data(指标) | 中,服务指标判读 | 高 | 高 | 高,比较轴与说明聚合 |
| comparison(对比) | 中强,引导结论 | 高 | 高 | 高,对比维度上下对齐 |
| process(流程) | 中,服务步骤先后 | 高 | 高 | 很高,步骤/警示贴近 |
| quote(金句) | 强,靠尺度断层 | 中 | 低 | 中,大量留白 |

### 字段映射速览

| CRAP | 优先落在本仓库哪些字段/手段 |
|------|------------------------------|
| Contrast | `visual_weight` / `data_elements[].type` 主次 / SVG 字号尺度断层 / accent 面积差 |
| Alignment | `layout_type` / SVG 共同基线·列·中心轴 |
| Repetition | 风格 YAML 设计基因(色彩/字体) / 同角色同 `<rect>` 语法 |
| Proximity | `data_elements` 分组 / `key_message` 聚合 / 卡片间距 |

---

## 原则 1. 视觉层级
核心问题:这一页谁是主角,谁必须退后?

优先影响字段:`visual_weight` / `layout_type` / `data_elements[]` 的主次安排 / SVG accent 处理。

修正手法:
- 整页没有焦点:提高锚点元素的视觉权重(更大字号 / `accent` 填充)。
- 所有元素一样重:只保留 1 个锚点,其余降级为支撑。
- 标题和内容都在平均发力:制造字号断层,禁止等高等宽平均分配。
- 对比策略只写"突出重点":改成具体对比轴(标题尺度断层 / 主图 vs 支撑面积差 / 深浅对比而非装饰噪声)。

危险信号:3 个以上元素都用实底填充;没有锚点;`visual_weight=high` 却把所有重点压成相近字号。

---

## 原则 2. 认知负荷
核心问题:观众这一页需要消化多少东西?

优先影响字段:`visual_weight` / `data_elements` 数量 / `layout_type`。

修正手法:
- 一页塞太多:拆成两组或下沉到下一页。
- 必须保留高信息量:本页标 `visual_weight=high`,下一页安排低密度缓冲。
- 信息少却做得很满:改成 `single_focus`。
- 信息不多却看起来乱:先检查 Proximity 是否失败,而非先删内容。

危险信号:content 页 5 个以上 `data_elements` 且都想当主角;一页同时放 3 种图表;`visual_weight=low` 但内容非常密。

---

## 原则 3. 构图与留白
核心问题:空间是在说话,还是只是装内容?

优先影响字段:`layout_type` / SVG 重力分布(见 `layout-craft.md`)/ 背景装饰层。

修正手法:
- 布局描述落回"左边一块右边两块":改写为重力关系而非像素切块(见 `layout-craft.md`)。
- 连续两页结构像克隆:至少换 2 个反差维度(重心 / card 语法 / 留白 / 装饰)。
- 金句或 section 仍很拥挤:下调 `visual_weight`,用 `single_focus`/`full_bleed`。
- 元素"差不多对齐":明确基线、列、带状区或中心轴,而非模糊方位词。
- data/comparison/process 场景默认要求更强 alignment;不要拿 cover 的自由重力去做密集看板。

危险信号:"三栏均分""上下两块"这类网页式描述;相关元素与无关元素距离相近看不出分组。

---

## 原则 4. 色彩与装饰克制
核心问题:这一页的装饰是在服务信息,还是在抢戏?(配色理论详见 `color-psychology.md`)

修正手法:
- 装饰很多却无主次:保留 1 个页面级手法 + 1 个元素级手法。
- 页与页完全不像同一套 deck:回到风格 YAML 的设计基因统一色彩/字体。
- 太稳太像模板:加强背景/accent 表现但写明克制。
- Repetition 要重复的是标题角色、标签角色、注释角色、边框语法,不是构图结果。

危险信号:每页装饰组合完全一样;accent 元素超过 1 个/页。

---

## 原则 5. 数据表达诚实
核心问题:数据是证据,不是贴纸。

优先影响字段:`data_elements[]`(`metric`/`chart`)/ `key_message`。

修正手法:
- 没有具体数据时不要假装做数据页,改成论述或金句。
- 有核心 KPI 时至少安排 1 个 `metric` 高亮或带图表的 `chart`。
- 图表只是装饰时删掉它。

危险信号:图表只是"为了看起来专业";`key_message` 是判断句但没有任何证据元素承接。

---

## 原则 6. 节奏与变奏
核心问题:翻页时有呼吸和推进吗?

优先影响字段:`visual_weight` / `layout_type` / 相邻页差异。

修正手法:
- 连续两页高压,第三页必须降压或视觉降密。
- 同一 `layout_type` 复用时换掉至少 2 个维度:重心 / card 语法 / 技法 / 留白。
- 相邻页技术组合雷同,直接重写画法。

危险信号:3 页连续 `visual_weight=high`;3 页连续同一 `layout_type`。

---

## CRAP 反模式速查
- **Contrast 失效**:所有字号、字重、面积都差不多,观众不知道先看哪里。
- **Alignment 失效**:元素"差不多对齐",但没有共同列线、边界线或中心轴。
- **Repetition 失效**:同样是标题/标签/注释/指标块,却每页换语法。
- **Proximity 失效**:标题、说明、指标、注释互相散开,只能靠文字解释关系。
- **误用 CRAP**:把 data/comparison 做成 cover 式 hero;或把 cover 做成死板表格页。

---

## 字段纠偏表

| 发现的问题 | 先改哪个字段 | 再看哪里 |
|-----------|------------|----------|
| 页面对但不惊艳 | SVG 镜头感/构图 | 装饰层 |
| 页面像网页 | `layout_type` | `layout-craft.md` 重力场 |
| 元素都一样 | SVG card 语法(`<rect>`) | `data_elements` 主次 |
| 节奏过平 | `visual_weight` | 相邻页差异 |
| 装饰乱 | 装饰克制 | 设计基因统一 |
| 论点强但证据弱 | `data_elements`(metric/chart) | `key_message` |

---

## 逐页 8 项体检单
- 这页的 `key_message` 是否是一句可判断的完整论点?
- `data_elements` 是否存在清晰主次,而不是平均铺开?
- `layout_type` 是否真的匹配内容结构,而不是习惯套版?
- SVG 是否给出明确镜头感?
- 装饰层是否各司其职、是否服务信息?
- 与上一页是否至少有 2 个维度不同?
- 是否说中了这页最危险的模板化风险?
- slide-core 拿到这页 outline 后,是否知道什么是合同、什么可自由发挥?
