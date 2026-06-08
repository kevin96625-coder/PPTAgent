# P6 — 跨页配图一致性 + 审查驱动重绘(post-M2.5 精简版)设计

> 状态:设计 → 自审 → 执行(2026-06-08)。上游:`FUSION_ROADMAP.md` §P6。依赖:M2.5(图片管线已建)、image-gen(generate.js 已支持 `--reference`/`--redo`/`--seed`)。
> **活路线图修正**:M2.5 已交付 P6 约 70%(asset 字段、搜图、单图生成、SVG→PNG、资产维度审查、预览门、`<image>` 嵌入)。本里程碑只补**两个真正缺口**,跳过低价值项。

## 0. 为什么是这个精简范围(自审前置)

M2.5 已让"每页一张真实图 + 看图审查"跑通。映射调研发现 P6 仅剩四项缺口,按价值排序后**只做前两项**:

| 缺口 | 价值 | 做不做 |
|------|------|--------|
| **A. 跨页参考图一致性**(同一主体/角色跨多页保持一致,经 `--reference`) | **极高** —— 正是用户主线需求(主日学同一圣经角色跨页一致;发布会同一产品跨页一致) | ✅ 做 |
| **B. 审查驱动 `--redo` 重绘闭环**(资产维度评分 <6 → 重生成,而非手绘假图或放弃) | **高** —— 闭合 M2.5 的审查→修复环;否则坏生成图只能留占位 | ✅ 做 |
| C. seed 确定性缓存 | 中 | 折进 B(redo 带 seed),不单列 |
| D. 多图每页 | 低 | ❌ 跳过(YAGNI;真要时再说) |

**与 M2.5 的关系(无冲突,纯增量)**:复用同一 `asset` 字段、同一 `images-manifest.json`、同一 generate.js、同一资产审查维度。P6 只在这套既有架构上:① 让生成调用带 `--reference`;② 新增一类 `regenerate_image` 审查建议并路由到 `--redo`。

## 0.1 设计铁律(继承 M2.5/M2.6 哲学)

- **master = 组内首生成图,预览门可替换并触发重派生**(**[自审补丁 #1 — 时序]**):配图在 Phase 3(research-core)生成,**早于** Phase 6 预览门,所以"master 必须先过人工门"在时序上不可能。正确做法:Phase 3 **先生成 master、再用 `--reference` 派生本组其余页**(此时即得一致性);随后 Phase 6 预览门若用户**替换/否决 master**,则**用新 master 重派生整组**(或对个别页交给 B 的 redo 闭环)。即 master 是"首生成"而非"已认可";认可发生在预览门,可回改。
- **seed 策略按目的相反(**[自审补丁 #2]**)**:
  - **一致性派生(A)**:派生页用 **master 的 seed + `--reference master`** → 求"长得一样"。
  - **审查驱动重绘(B)**:redo 是因为图**不好**,必须**换 seed**(取不同样本)+ 可把审查 `reason` 追加进 prompt → 求"换一张更好的"。**绝不复用原 seed**(否则原样重生成同一张坏图)。
  - **派生页若被 redo**:仍传 `--reference master`(保持角色一致)但**换 seed**(换姿势/构图)——一致 + 变好兼得。master 页被 redo:换 seed 重生成后**重派生全组**。
- **redo 有上限**:`--redo` 重绘**每页封顶 2 轮**(与既有 fix-round 上限对齐),且**仅由资产维度 critical(<6)触发**。绝不无限重绘(控成本)。
- **重绘不造假**:redo 仍是"重新生成/重新搜图",绝不退化成 slide-core 手绘假物(M2.5 铁律延续)。
- **优雅降级**:image-gen / 搜图不可用时,维持 M2.5 的 `status:missing` + `needs_real_image` 占位,不阻塞、不假图。

## 1. 交付物

| # | 交付 | 类型 |
|---|------|------|
| A1 | `lib/asset-consistency.js` — 从 outline 识别**共享主体组**(多页 `asset.query` / `asset.subject` 指向同一主体),决定每组的 master 页 + 派生页,产出"参考图计划" | Node 纯逻辑 + 测试 |
| A2 | outline `asset` 增可选 `subject` 字段(显式主体 key,用于把跨页同一角色/产品归组;缺省回退到 query 归一化) | schema + validator |
| A3 | research-core 接线:按参考图计划——先产 master 图 → 通过资产审查/预览门后 → 派生页 `generate.js --reference <master>`;manifest 记 `reference_of` | 散文接线 |
| B1 | `lib/redo-plan.js` — 输入资产审查结果 + manifest,产出"待重绘页 + 各页 redo 轮次",**封顶 2**,只对 `kind=scene`(生成图)走 `--redo`;`kind=brand-entity`(搜图)走"重搜/换图"建议 | Node 纯逻辑 + 测试 |
| B2 | reviewer 资产维度新增 `regenerate_image` 建议类型(含 reason + 是否触顶) | 散文(reviewer.md) |
| B3 | review-core / Phase 6 接线:资产维度 critical → 调 redo-plan → 对 scene 图 `generate.js --redo`(带原 prompt+reference+seed)、对 brand 图回预览门换图;轮次耗尽则保留占位 + `needs_real_image` | 散文接线 |
| C | manifest 增字段 `seed` / `redo_count` / `reference_of`(复用 image-gen 既有 manifest 字段语义,在 images-manifest 侧记录交叉引用) | images-manifest.js |

**不做**:多图每页(D)、独立缓存层(seed 折进 redo)。

## 2. 数据契约

### 2.1 outline `asset.subject`(新增可选)
```json
"asset": {
  "needed": true,
  "kind": "scene",
  "subject": "shepherd-boy-david",   // 可选:跨页同一主体的稳定 key
  "query": "牧羊少年大卫 站在旷野",
  "caption": "少年大卫"
}
```
- `subject` 缺省时,归组回退用 `query` 的归一化(去标点/空白/小写)做近似 key。
- validator:`subject` 若存在须为非空字符串(软规则,缺省合法)。**向后兼容**(M2.5 outline 无此字段仍有效)。

### 2.2 参考图计划(asset-consistency 输出)
```js
planReferences(outline) -> {
  groups: [
    { subject:'shepherd-boy-david', master_page:3, derived_pages:[5,8], kind:'scene' }
  ],
  singletons: [ { page:2, kind:'brand-entity' } ]   // 不共享主体的页,照旧单图
}
```
规则:
- 同 subject(或归一化 query)且 `kind=scene` 的页 ≥2 → 成组;`master_page` = 该组最小页号(通常最早出现,叙事上先建立形象)。
- `kind=brand-entity`(真实产品搜图)**不强制成组**(搜到的真实官图天然一致);但同 subject 的 brand 页可共享同一下载图(派生页直接复用 master 的已下载文件,免重复搜)。
- 单页主体 → singleton,走 M2.5 原路径。

### 2.3 redo 计划(redo-plan 输出)
```js
planRedo(reviewResults, manifest, { cap:2 }) -> {
  redo: [ { page:5, kind:'scene', round:1, reason:'...', reference_of?:3 } ],
  reshoot: [ { page:2, kind:'brand-entity', reason:'...' } ],  // 回预览门换图
  exhausted: [ { page:8, reason:'redo cap reached -> keep placeholder' } ]
}
```
- 只对 `status=generated`(scene)且资产分 <6 且 `redo_count<cap` 的页进 `redo`。
- `brand-entity` 低分 → `reshoot`(回 Phase 6 预览门人工换/补官图),不自动 `--redo`(搜图非生成)。
- 触顶 → `exhausted`,保留占位 + 标 `needs_real_image`,**不假图**。

## 3. 接线(散文)

### 3.1 research-core.md(Asset Collection 段)
- 调用前先跑 `asset-consistency` 出参考图计划。
- **分组生成顺序**:每组先生成/确认 master 图;master 经资产门(或预览门)后,派生页 `generate.js ... --reference <master_path> --seed <master_seed>`(同 seed 利于一致)。
- manifest:派生页记 `reference_of: <master_page>`;master 记 `seed`。
- 优雅降级:master 生成失败 → 整组退回各自单图(M2.5 路径)+ 记 missing,不阻塞。

### 3.2 reviewer.md(资产维度)
- 新增建议类型 `regenerate_image`:当资产分 <6 且页为生成图时输出,含 `reason`(为何需重绘)。明确这是"重生成"非"手绘修补"。

### 3.3 review-core.md / commands/ppt.md Phase 6
- 资产维度 critical 汇总后跑 `redo-plan`:
  - `redo` 列表 → 对应页 `generate.js --redo`(带原 prompt-file + 审查 reason 追加 + `--reference master`(若属某组,保一致)+ **新 seed**(换样本,**不复用原 seed**)),重渲染后**复审一次**;
  - `reshoot` 列表 → 回 Phase 6 预览门提示用户换/补官图;
  - `exhausted` → 保留占位 + `needs_real_image`,过审不阻塞交付(M2.5 既有行为)。
- redo 轮次写入 manifest `redo_count`;封顶 2。

## 4. 测试(node:test)
- `asset-consistency.test.js`:① 同 subject 多 scene 页成组 + master=最小页;② 同归一化 query 成组(无 subject);③ brand-entity 不强制成组但同 subject 复用文件;④ 单页 singleton;⑤ 空/缺 asset 不报错。
- `redo-plan.test.js`:① scene 低分 <6 进 redo;② brand 低分进 reshoot 不进 redo;③ redo_count≥cap 进 exhausted;④ 分≥6 不动;⑤ 缺字段/垃圾输入不抛错;⑥ reference_of 透传。
- validator:`asset.subject` 非空校验 + 向后兼容(无字段通过)。
- prose grep:research-core 含 `--reference`/`reference_of`;reviewer 含 `regenerate_image`;review-core/ppt.md 含 redo 上限与"keep placeholder / 不假图"锚点。

## 5. 验收(并入 dogfood 清单)
- 同一主体跨页**视觉一致**(参考图生效)——用户主线需求兑现。
- 某资产页首生成不佳 → 触发 `--redo` 自动重绘并复审通过;触顶则占位不假图。
- manifest 含 `reference_of`/`seed`/`redo_count`。
- redo 不致无限循环(封顶 2 可见于 manifest)。
