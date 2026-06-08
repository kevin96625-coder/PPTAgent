# 失败模式与修复优先序 — review-core / QA 速查

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: failure-mode taxonomy for QA. Field terms remapped to this repo's `outline.json` (`pages[].{type,layout_type,data_elements,visual_weight,key_message,asset}`) and to its pure-SVG output. NOT Akxan's HTML/`cards[]` runtime.

本文件沉淀单页设计链路的 **8 类失败模式 + 修复优先序**。它定义**合同违约和修复顺序,不定义某种审美风格、不压制创新**。review-core 在 QA 阶段固定读本文件,把"修复顺序铁律"作为提改建议的排序依据;slide-core/content-core 可在自检时对照。

**本仓库术语映射**(Akxan → 本仓库):
- `cards[]`/`card_type` → `pages[].data_elements`(每页的内容元素:`metric`/`chart`/`text`/`list` 等)。
- `card_style`/`decoration_hints` → SVG 落地的 `<rect rx fill stroke>` / `<g>` 装饰层(见 `blocks.md`)。
- `scene_mode`/`planning.json` → `pages[].{type,visual_weight}` + 风格 YAML。
- "HTML/div" 类征兆 → 本仓库为纯 SVG,失败征兆按 SVG 元素读(`<text>`/`<rect>`/`<g>`)。

---

## 1. 内容未完成类(4 种)

### 1.1 underfill(信息密度过低)
- **触发条件**:页面视觉成立,但信息载荷明显不足。
- **失败征兆**:单页有效信息过少,装饰(光晕/分隔线/大留白)远多于内容;`data_elements` 稀薄。
- **允许创新区**:可以改变构图,但不可以拿留白代替内容合同。
- **修复**:从 `materials.md`/`requirements.md` 补数据/案例/解读,填到该页 `visual_weight` 对应的密度目标(参见 `references/density-targets.json`)。

### 1.2 support_collapse(支撑层塌陷)
- **触发条件**:除主锚点外,没有承担解释、比较、证据或上下文的支撑元素。
- **失败征兆**:页面只剩一个大标题 + 一两个大数字,缺承托层。
- **允许创新区**:可以改变支撑形式(list / metric / process / quote),但必须补足支撑任务。
- **修复**:content 页 ≥ 3 个 `data_elements` 且 ≥ 2 种类型,至少 1 个数据型(`metric`/`chart`)。

### 1.3 payload_missing(关键信息缺失)
- **触发条件**:outline 的 `key_message` 没有被该页完整执行。
- **失败征兆**:关键论断没有证据、步骤、条件或来源承接。
- **允许创新区**:可以重排内容,但不可以省略 `key_message` 要求交付的信息。
- **修复**:对照该页 `key_message` 与 `data_elements`,逐条补齐到 SVG。

### 1.4 source_overclaim(论断超出资料支持)
- **触发条件**:页面结论强于 `materials.md` 的支持力度。
- **失败征兆**:论断看起来完整,但搜索资料包没有足够证据。
- **允许创新区**:可以强化表达节奏,但不可以夸大事实边界。
- **修复**:弱化结论措辞或回补搜索(如"有望成为"改"在 X 行业初见端倪")。

---

## 2. 视觉失真类(4 种)

### 2.1 launch_drift(开场风格漂移)
- **触发条件**:cover/section 页把整套 deck 拉向与内容不匹配的发布会语气。
- **失败征兆**:后续 content 页难以承接,风格偏置持续放大。
- **允许创新区**:可以做强开场,但必须服从受众与演示场景(自阅文档/现场/培训)。
- **修复**:核对 `requirements.md` 的场景;若是"自阅文档",cover 应低调而非舞台感。

### 2.2 anchor_overexpansion(锚点过度膨胀)
- **触发条件**:大数字/大标题占据全部注意力,支撑内容失去存在空间。
- **失败征兆**:页面单看有冲击,但论证不完整。
- **允许创新区**:可以放大锚点,但不可以吞掉支撑层。
- **修复**:缩小锚点占比至 ≤ 50% 画面面积;增加支撑元素或留出阅读路径。

### 2.3 deck_rhythm_clone(节奏克隆)
- **触发条件**:多页使用同构 `layout_type`、同构装饰、同构锚点关系。
- **失败征兆**:整套 deck 有统一性但没有节奏推进。
- **允许创新区**:可以重复设计基因(色彩/字体系统),但不可以复制结果。
- **修复**:密度交替——高密度页(`dashboard`/`mixed_grid`)后跟低密度页(`single_focus`/section 封面);相邻页至少换 2 个维度(重心/装饰/留白)。

### 2.4 decorative_substitution(装饰替代内容)
- **触发条件**:用渐变、光效、分隔线替代真实信息组织。
- **失败征兆**:页面看起来复杂,实际信息承载能力下降。
- **允许创新区**:可以强化材质,但不可以让装饰接管结构任务。
- **修复**:删除"为装饰而装饰"的 `<g>`;自问"删掉这个装饰,页面信息会损失吗?"——不会就删。

---

## 3. 修复顺序铁律

任何修复都按以下顺序执行,**不得跳过前两步**:

1. **先补 payload**(内容是地基)
2. **再补 support 与 context**(支撑元素是承托)
3. **再校正 anchor 的比例与位置**(视觉是叙事)
4. **最后调装饰、材质和局部表现**(装饰是收尾)

不能用装饰调整掩盖内容合同缺失。review-core 提改建议必须按此排序——先驳内容缺失,再谈美学微调。

---

## 4. 创新自由区
- 创新允许发生在:构图、节奏、装饰组合、锚点表现、SVG 材质层次。
- failure mode 只约束违约,不约束风格实验。
- 只要内容合同完整、阅读路径清晰、风格系统稳定,允许页面做高差异化探索。

---

## 5. 自动/启发式检测对照(本仓库)

| 失败模式 | 检测启发式(SVG/outline 视角) |
|---------|------------------------------|
| underfill | 单页 `<text>` 总字数 < 80(cover/section 除外);或 `data_elements` < 2 |
| support_collapse | content 页 `data_elements` < 3 或类型种类 < 2 |
| anchor_overexpansion | 单一元素占用面积 > 65% |
| decorative_substitution | `data-decorative` 元素数 > 文本 `<text>` 数 × 1.5 |
| deck_rhythm_clone | 连续 3+ 页同一 `layout_type` |
| off-ladder / accent-overload | `type-color-cli.js` 的 P3 软信号(advisory) |

其余(payload_missing / source_overclaim / launch_drift)需人工或 Gemini 视觉 QA 介入。
