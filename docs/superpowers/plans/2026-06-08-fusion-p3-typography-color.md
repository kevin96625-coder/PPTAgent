# P3 执行计划 — 排版阶梯 + 60/30/10 配色(安全瘦版)

> spec(单一来源):`specs/2026-06-08-fusion-p3-typography-color-design.md`。
> 铁律:**P3 绝不自动改写 SVG;校验器只产软警告、永不硬阻塞、exit 恒 0、永不抛错。** 复用 `color-contrast.js`,不重复 WCAG 数学。
> 测试:`node:test`,co-located 于 `skills/_shared/test/`;run `cd skills/_shared && npm test`。
> 工作目录:`/Users/kevinchen/PPT_Agent/ppt-agent`。直提 main,不开分支。

## 任务清单(TDD:先红后绿)

### Task 1 — `lib/type-scale.js` + 测试
- 新建 `skills/_shared/scripts/lib/type-scale.js`,导出 `analyzeTypeScale(svg, { ladder, effectiveScale })`。
- 行为见 spec §3.1:正则抓所有 `font-size="N"`(跳过 `data-decorative="true"` 的 text/tspan,沿用 svg-autofix 的 decorative 判定思路但**只读**);
  - `distinctSizes` / `sizes`(去重排序);
  - `too-many-sizes` 软警告(>6);
  - `off-ladder`:档位 = `Object.values(ladder).map(v => v * (effectiveScale||1))`;某 size≥14 距最近档位相对偏差 >0.25 记入 `offLadder`;`effectiveScale` 未传则把 offLadder 标 `bestEffort:true` 且不计入"应处理"集合;
  - 返回 `{ distinctSizes, sizes, offLadder, warnings }`,warnings 每项 `{ code, detail }`。
- **绝不**返回 svg、**绝不** throw(包裹解析于 try,异常时返回空分析 + 一条 `code:'parse-skip'` info,exit 仍 0)。
- 测试 `test/type-scale.test.js`(spec §5 六条 + parse 容错):
  1. 三种字号 → distinctSizes=3,无 too-many;
  2. 7+ 种 → too-many-sizes;
  3. 阶梯内字号(乘 scale)→ offLadder 空;
  4. 明显偏离(如 50 距最近 40/64 都 >25%)→ 记入 offLadder;
  5. `data-decorative` 文本 / micro(<14)被放过;
  6. 喂垃圾字符串不抛错、warnings 不含 hard error;
  7. effectiveScale 缺省时 offLadder.bestEffort=true。

### Task 2 — `lib/color-ratio.js` + 测试
- 新建 `skills/_shared/scripts/lib/color-ratio.js`,导出 `analyzeColorRatio(svg, { colorScheme, colorRatio })`,复用 `require('./color-contrast').hexToRgb`。
- 面积估算(spec §3.2):正则抓 `<rect ... fill="#..">`(w×h)、`<circle ... fill>`(πr²)、`<ellipse>`(π rx ry)。无显式 hex fill / `url(...)` → 该形归 `other` 但仍累计入"总形面积"用于不足面积判断?**否**:other 形若是 url/图片不计面积(无几何或几何不可信按规则:rect/circle/ellipse 有几何就算面积,fill 不匹配 token 则归 other 桶面积)。明确:
  - 有几何的基本形 → 算面积;按 fill 归桶(就近匹配 token,RGB 欧氏距离<48;匹配不到→other 桶);
  - `<path>`、`<image>`、无几何形 → 跳过(计入"未测面积",不进任何桶);
  - `data-decorative` 形面积 <0.5% 画布(1280×720=921600)忽略。
- **不足面积守卫(自审补丁#2)**:可测量面积(dominant+secondary+accent+other 桶面积和)< 30%×921600 → 返回 `{ insufficient_area:true, warnings:[], caveat }`,不产配色警告。
- 否则归一化(三桶 ÷ 三桶和,剔除 other),比对 budget,产 `accent-overload`(>0.25)/`no-dominant`(<0.35)软警告;`deviations` 全量记录;**永远** `caveat`。
- token 归桶:用 `colorRatio.buckets`(token 名→桶)+ `colorScheme`(token 名→hex)解析出"桶→hex 列表",再对每个形 fill 找最近 hex 定桶。
- **绝不**返回 svg、**绝不** throw、exit 0。
- 测试 `test/color-ratio.test.js`(spec §5 六条):
  1. rect/circle/ellipse 面积数值正确(给定坐标手算);
  2. token 就近归桶(精确 hex + 近似 hex<48 都归对桶,远 hex 归 other);
  3. accent 形面积过大 → accent-overload;
  4. chart 多色(不在 buckets 的 hex)→ other,不污染 dominant/secondary/accent 分母;
  5. 全 path/image 的 svg → insufficient_area:true 且无警告 + 有 caveat;
  6. 垃圾输入不抛错、exit 0。

### Task 3 — CLI `scripts/type-color-cli.js` + 测试
- 新建 `skills/_shared/scripts/type-color-cli.js`:`--svg <path> --style <yaml>`;读 YAML(用既有 YAML 读取方式——查 planning-validator-cli 怎么读 json/yaml,保持一致;若无 yaml 解析依赖,用既有 `_shared` 里读 style 的工具或最小手解析 `typography_ladder`/`color_ratio`/`color_scheme`)。输出合并 JSON 报告 `{ typeScale, colorRatio }`。**exit code 恒 0**。
- 若 `_shared` 无 YAML 解析器:优先复用 slide-core/已有读 style 的脚本;否则在 CLI 内写一个**极简**只解析所需三块的 reader(并加测试)。先 grep 现有怎么读 style YAML,避免引新依赖。
- 测试:跑 CLI 对一个 fixture svg+style,断言 JSON 结构 + exit 0。

### Task 4 — 18 个 style YAML 增字段 + grep 结构测试
- 给 `skills/_shared/references/styles/*.yaml`(全部)追加**统一**的两块(spec §2.1/§2.2),`typography_ladder` 7 键值全 style 相同,`color_ratio.buckets` 引用 token 名(全 style 相同结构)。
- 暗色封面类 style 同样追加(buckets.dominant 仍=background,逻辑通用)。
- 测试 `test/styles-p3-fields.test.js`:遍历 styles 目录所有 .yaml,断言每个含 `typography_ladder`(h1..micro 7 键)+ `color_ratio`(dominant/secondary/accent + buckets 三桶)。

### Task 5 — 参考文档 `references/typography-ladder.md`
- 写 7 级阶梯规范(每级 px、用途、CJK 行高 +20% 注意、micro 是唯一允许 <14 的角色),标注"通用设计规范/非原帖/待复核"。
- grep 结构测试可选(若 _shared 有 prose 测试约定则加;否则跳过)。

### Task 6 — slide-core.md 接线(生成期 + 软警告记录)
- "Typography" 段:引用 `typography_ladder` + `references/typography-ladder.md`,要求就近选档(hero 数字可特例);引用 `color_ratio` 预算(大面积 dominant、accent ~10%)。
- "Post-Generation Validation" 段末:追加 advisory 步骤——跑 `type-color-cli`,把软警告记入 slide-status,**明示 these are advisory; never auto-rewrite, never block, never trigger re-draw**。
- 散文 grep 测试:slide-core.md 含 "typography_ladder"、"advisory"、"never auto-rewrite"/"不改写" 等锚点(按现有散文测试风格;若无则只人工核)。

### Task 7 — reviewer.md / review-core.md 接线
- review-core.md:Gemini 调用前附 C/D 软警告作"deterministic hints",**不**加 Gemini 硬规则。
- reviewer.md:Quality Standards **不**新增硬阻塞;在参考信号处说明可消费 hints。

## 执行方式
- 子代理 TDD,逐 Task 红→绿;每 Task 完成跑 `cd skills/_shared && npm test` 全绿。
- 全程不碰 `svg-autofix.js`、不碰任何会改写 SVG 的路径(结构性保证零回退)。
- 完成后:多代理审核(spec 符合度 + 代码质量 + "会不会拖累/误导生成"的整体审)→ 修 → 回填路线图。

## 完成定义(DoD)
- 全测试绿(含新增 type-scale/color-ratio/styles 测试)。
- 18 style 都有新字段;CLI exit 0;两个 analyzer 都不导出任何写 SVG 的函数、都不 throw。
- slide-core/review-core 接线就位且明示 advisory-only。
- 路线图 P3 标 ✅ 代码完成,记忆回填。
