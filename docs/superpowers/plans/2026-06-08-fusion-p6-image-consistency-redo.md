# P6 执行计划 — 跨页配图一致性 + 审查驱动重绘(post-M2.5 精简版)

> spec(单一来源):`specs/2026-06-08-fusion-p6-image-consistency-redo-design.md`。
> 依赖既有:image-gen `generate.js` 已支持 `--reference`(逗号分隔路径)/`--redo`(仅在已有 manifest entry 时 +1 redoCount;变化靠 seed/prompt,非 redo 本身)/`--seed`(Number)。M2.5 图片管线已建。
> 测试 node:test,co-located `skills/_shared/test/`。工作目录 `/Users/kevinchen/PPT_Agent/ppt-agent`,直提 main。
> 纯逻辑库**只读规划**,不真正调 generate.js(那在 agent 散文里);不抛错、对缺字段优雅降级。

## Task 1 — `lib/asset-consistency.js` + 测试
- 导出 `planReferences(outline)`,见 spec §2.2。
- 归组:遍历 outline 各 part/page 的 `asset`;key = `asset.subject` ?? 归一化(`asset.query` 去标点/空白/小写)。同 key 且 `kind=scene` 且页数≥2 → group(`master_page`=最小页号,`derived_pages`=其余升序,`kind:'scene'`);同 key `kind=brand-entity` 多页 → 也成组但标 `kind:'brand-entity'`(语义=派生页复用 master 已下载文件,不重搜);其余 → singletons。
- 容错:无 asset / asset.needed=false / 空 outline → groups 空、singletons 合理;绝不抛错。
- 测试 `asset-consistency.test.js`:spec §4 五条(同 subject 成组+master 最小页;同归一化 query 成组;brand 成组标记;singleton;空/缺容错)。

## Task 2 — `lib/redo-plan.js` + 测试
- 导出 `planRedo(reviewResults, manifest, { cap=2 })`,见 spec §2.3。
- `reviewResults`:数组,每项含 `{ page, assetScore, kind, reason }`(资产维度分;<6=critical)。`manifest`:images-manifest 形,含每页 `status`/`redo_count`/`reference_of`。
- 规则:scene 且 assetScore<6 且 (redo_count||0)<cap → `redo`(round=redo_count+1,透传 reference_of);brand-entity 且 <6 → `reshoot`;scene 且 redo_count≥cap → `exhausted`(reason 含 'redo cap reached -> keep placeholder');score≥6 → 不动。
- 容错:缺 assetScore/缺 manifest entry/垃圾 → 跳过该页、不抛错。
- 测试 `redo-plan.test.js`:spec §4 六条。

## Task 3 — outline `asset.subject` + validator
- `outline-architect.md` asset schema 段:加可选 `subject`(说明:跨页同一主体的稳定 key;主日学同角色/发布会同产品跨页一致用)。
- `planning-validator.js`:若 `asset.subject` 存在则须非空字符串(否则 soft warning 或 hard?——**soft warning**,保持向后兼容;缺省合法)。加测试到既有 planning-validator.test.js:有 subject 且为空 → warning;无 subject → ok;正常 subject → ok。

## Task 4 — images-manifest `reference_of`/`seed`/`redo_count` 字段
- `images-manifest.js` `makeEntry(...)`:接受并透传可选 `reference_of`(number)、`seed`(number)、`redo_count`(number,默认 0)。`validateManifest`:这些字段若存在须为数字;缺省合法(向后兼容 M2.5 entry)。
- 测试补到 `images-manifest.test.js`:带新字段的 entry 校验通过;类型错 → invalid;旧 entry(无新字段)仍 valid。

## Task 5 — research-core.md 接线(分组生成 + 参考图)
- Asset Collection 段:生成前跑 `asset-consistency`;按组——先生成 master(scene)→ 派生页 `generate.js --reference <master_out> --seed <master_seed> ...`;manifest 派生页记 `reference_of=master_page`、master 记 `seed`。
- brand-entity 组:master 页搜图下载;派生页直接复用 master 已下载文件(免重搜),manifest 记 `reference_of`。
- 优雅降级:master 失败 → 整组退回 M2.5 单图路径 + missing,不阻塞。
- prose grep 锚点:`asset-consistency`、`--reference`、`reference_of`、"master"、"降级/单图"。

## Task 6 — reviewer.md `regenerate_image` 建议类型
- 资产维度段:新增建议类型 `regenerate_image`(资产分<6 且页为生成图时),含 `reason`;明示"重生成,非手绘修补"。
- prose grep:`regenerate_image`。

## Task 7 — review-core.md / commands/ppt.md Phase 6 接线(redo 闭环)
- 资产 critical 汇总 → 跑 `redo-plan`:`redo` → `generate.js --redo`(原 prompt-file + reason 追加 + `--reference master`(若属组)+ **新 seed**,**不复用原 seed**)→ 重渲染 → 复审一次;`reshoot` → 回 Phase 6 预览门换/补官图;`exhausted` → 保留占位 + `needs_real_image`,不阻塞交付、不假图。
- redo 轮次写 manifest `redo_count`;封顶 2。
- 预览门若用户替换 master → 重派生整组(spec §0.1 补丁#1)。
- prose grep:`redo-plan`、`--redo`、"新 seed/不复用"、"封顶 2 / cap"、"keep placeholder / 不假图"、"重派生"。

## 执行
- 子代理 TDD,逐 Task 红→绿;`cd skills/_shared && npm test` 全绿。
- 纯逻辑库不抛错、不真正调外部命令(规划 only)。
- 完成 → 多代理对抗审核(时序正确性 + seed 策略 + redo 不致死循环 + 优雅降级 + 接线是否真把 --reference 传到 generate.js)→ 修 → 回填路线图。

## DoD
- 新增 asset-consistency / redo-plan / validator / manifest 字段测试全绿。
- 散文接线就位且 grep 锚点齐;一致性 master-first + redo 换 seed + 封顶 2 + 降级不假图 全部明示。
- 路线图 P6 标 ✅ 代码完成,记忆回填。
